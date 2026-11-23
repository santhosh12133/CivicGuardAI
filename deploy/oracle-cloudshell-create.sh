#!/usr/bin/env bash
# Creates a server for CivicFix on Oracle Cloud from Oracle Cloud Shell (the >_ icon in the Oracle console), using
# Always Free resources: its own network with ports 22/80/443 open, and a VM that installs CivicFix on first boot
# (deploy/oracle-cloud-init.sh -> deploy/setup-server.sh, own Caddy with free HTTPS on <name>.<ip>.sslip.io).
#
#   curl -fsSL https://raw.githubusercontent.com/santhosh12133/CivicGuardAI/main/deploy/oracle-cloudshell-create.sh -o civicfix-create.sh
#   ADMIN_EMAIL='you@example.com' bash civicfix-create.sh
#
# Server size, tried in order (all Always Free):
#   1. Ampere A1 (arm64), 1 OCPU / 6 GB. Leaves 3 OCPU / 18 GB of the free A1 allowance for other servers.
#   2. AMD VM.Standard.E2.1.Micro, 1 GB RAM (the setup adds swap; the first build is slow, about 20-30 minutes).
# SHAPE=a1 or SHAPE=micro tries only one of them. Free capacity is often sold out: RETRY_MINUTES=360 keeps trying
# (every 2-5 minutes) for up to 6 hours; keep the Cloud Shell tab open while it runs.
# USE_TRIAL_CREDITS=1 uses an AMD VM.Standard.E5.Flex (1 OCPU / 4 GB) paid from a new account's trial credits
# instead (reclaimed when the trial ends unless the account is upgraded).
#
# The admin password is generated on the server and never passes through Cloud Shell or Oracle's settings:
#   ssh -i ~/.ssh/civicfix ubuntu@<ip> 'sudo cat /root/civicfix-credentials.txt'
#
# Safe to re-run: existing pieces (network, subnet, VM) are reused, and an existing VM's address is printed.
set -euo pipefail

NAME="civicfix"
REPO_RAW="https://raw.githubusercontent.com/santhosh12133/CivicGuardAI/main"
ADMIN_EMAIL="${ADMIN_EMAIL:?set ADMIN_EMAIL, e.g. ADMIN_EMAIL=you@example.com bash civicfix-create.sh}"
WORK="$HOME/civicfix-oci"
RETRY_MINUTES="${RETRY_MINUTES:-0}"
USE_TRIAL_CREDITS="${USE_TRIAL_CREDITS:-0}"
SHAPE_CHOICE="${SHAPE:-auto}"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
die() { printf '\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[[ "$ADMIN_EMAIL" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || die "ADMIN_EMAIL does not look like an email address"
command -v oci >/dev/null || die "Run this in Oracle Cloud Shell (the >_ icon at the top of the Oracle console)"
command -v jq >/dev/null || die "jq is missing"
mkdir -p "$WORK"

C="${OCI_TENANCY:-}"
if [ -z "$C" ]; then
  C=$(oci iam compartment list --include-root --compartment-id-in-subtree true --all \
      | jq -r '[.data[] | select(.id | startswith("ocid1.tenancy"))][0].id')
fi
[ -n "$C" ] && [ "$C" != null ] || die "Could not find your tenancy"
AD=$(oci iam availability-domain list --compartment-id "$C" | jq -r '.data[0].name')
echo "Region: ${OCI_REGION:-default}, availability domain: $AD"

# ------------------------------------------------------------------------------------------- existing VM?
EXISTING=$(oci compute instance list --compartment-id "$C" --display-name "$NAME" --all \
  | jq -r '[.data[] | select(."lifecycle-state" | test("RUNNING|PROVISIONING|STARTING"))][0].id // empty')
if [ -n "$EXISTING" ]; then
  INSTANCE="$EXISTING"
  log "The VM $NAME already exists; reusing it"
else
  # ------------------------------------------------------------------------------------------- network
  log "Network (separate from any other app's)"
  VCN=$(oci network vcn list --compartment-id "$C" --display-name "$NAME-vcn" --all | jq -r '.data[0].id // empty')
  if [ -z "$VCN" ]; then
    VCN=$(oci network vcn create --compartment-id "$C" --display-name "$NAME-vcn" --cidr-blocks '["10.1.0.0/16"]' \
      --dns-label civicfixvcn --wait-for-state AVAILABLE 2>/dev/null | jq -r '.data.id')
    [ -n "$VCN" ] && [ "$VCN" != null ] || die "Could not create the network (your account may have reached its VCN limit)"
    echo "Created network $NAME-vcn"
  else
    echo "Using network $NAME-vcn"
  fi
  VCN_JSON=$(oci network vcn get --vcn-id "$VCN")
  RT=$(jq -r '.data."default-route-table-id"' <<<"$VCN_JSON")
  SL=$(jq -r '.data."default-security-list-id"' <<<"$VCN_JSON")

  IGW=$(oci network internet-gateway list --compartment-id "$C" --vcn-id "$VCN" --all | jq -r '.data[0].id // empty')
  if [ -z "$IGW" ]; then
    IGW=$(oci network internet-gateway create --compartment-id "$C" --vcn-id "$VCN" --is-enabled true \
      --display-name "$NAME-igw" --wait-for-state AVAILABLE 2>/dev/null | jq -r '.data.id')
    echo "Created internet gateway"
  fi
  oci network route-table update --rt-id "$RT" --force \
    --route-rules "[{\"destination\":\"0.0.0.0/0\",\"destinationType\":\"CIDR_BLOCK\",\"networkEntityId\":\"$IGW\"}]" >/dev/null
  echo "Internet route set"

  cat > "$WORK/ingress.json" <<'JSON'
[
  {"source": "0.0.0.0/0", "protocol": "6", "isStateless": false, "description": "SSH",
   "tcpOptions": {"destinationPortRange": {"min": 22, "max": 22}}},
  {"source": "0.0.0.0/0", "protocol": "6", "isStateless": false, "description": "HTTP",
   "tcpOptions": {"destinationPortRange": {"min": 80, "max": 80}}},
  {"source": "0.0.0.0/0", "protocol": "6", "isStateless": false, "description": "HTTPS",
   "tcpOptions": {"destinationPortRange": {"min": 443, "max": 443}}},
  {"source": "0.0.0.0/0", "protocol": "17", "isStateless": false, "description": "HTTP/3",
   "udpOptions": {"destinationPortRange": {"min": 443, "max": 443}}},
  {"source": "0.0.0.0/0", "protocol": "1", "isStateless": false, "icmpOptions": {"type": 3, "code": 4}},
  {"source": "10.1.0.0/16", "protocol": "1", "isStateless": false, "icmpOptions": {"type": 3}}
]
JSON
  echo '[{"destination": "0.0.0.0/0", "protocol": "all", "isStateless": false}]' > "$WORK/egress.json"
  oci network security-list update --security-list-id "$SL" --force \
    --ingress-security-rules "file://$WORK/ingress.json" --egress-security-rules "file://$WORK/egress.json" >/dev/null
  echo "Opened ports 22, 80 and 443"

  SUBNET=$(oci network subnet list --compartment-id "$C" --vcn-id "$VCN" --display-name "$NAME-public" --all \
    | jq -r '.data[0].id // empty')
  if [ -z "$SUBNET" ]; then
    SUBNET=$(oci network subnet create --compartment-id "$C" --vcn-id "$VCN" --display-name "$NAME-public" \
      --cidr-block 10.1.0.0/24 --dns-label public --route-table-id "$RT" --security-list-ids "[\"$SL\"]" \
      --prohibit-public-ip-on-vnic false --wait-for-state AVAILABLE 2>/dev/null | jq -r '.data.id')
    echo "Created public subnet"
  fi

  # ------------------------------------------------------------------------------------------- VM
  log "Server image and start-up script"
  # Each entry: SHAPE|shape-config JSON (empty for fixed shapes)
  if [ "$USE_TRIAL_CREDITS" = 1 ]; then
    SHAPES=('VM.Standard.E5.Flex|{"ocpus": 1, "memoryInGBs": 4}' 'VM.Standard.E4.Flex|{"ocpus": 1, "memoryInGBs": 4}')
    echo "Using an AMD server paid from the free trial credits (reclaimed when the trial ends unless you upgrade)"
  else
    case "$SHAPE_CHOICE" in
      a1) SHAPES=('VM.Standard.A1.Flex|{"ocpus": 1, "memoryInGBs": 6}') ;;
      micro) SHAPES=('VM.Standard.E2.1.Micro|') ;;
      auto) SHAPES=('VM.Standard.A1.Flex|{"ocpus": 1, "memoryInGBs": 6}' 'VM.Standard.E2.1.Micro|') ;;
      *) die "SHAPE must be a1, micro or auto" ;;
    esac
  fi
  image_for() {  # newest non-minimal Ubuntu 24.04 image that runs on shape $1
    oci compute image list --compartment-id "$C" --operating-system "Canonical Ubuntu" --operating-system-version "24.04" \
        --shape "$1" --sort-by TIMECREATED --sort-order DESC --all \
      | jq -r '[.data[] | select(."display-name" | test("Minimal") | not)][0].id // empty'
  }

  curl -fsSL "$REPO_RAW/deploy/oracle-cloud-init.sh" -o "$WORK/user-data.sh"
  sed -i "s|^ADMIN_EMAIL=.*|ADMIN_EMAIL=\"$ADMIN_EMAIL\"|" "$WORK/user-data.sh"
  grep -q "^ADMIN_EMAIL=\"$ADMIN_EMAIL\"" "$WORK/user-data.sh" || die "Could not prepare the start-up script"

  # RSA: Oracle Cloud Shell runs in FIPS mode, which refuses ed25519 keys.
  [ -f "$HOME/.ssh/$NAME.pub" ] || ssh-keygen -q -t rsa -b 4096 -N "" -f "$HOME/.ssh/$NAME" -C "$NAME" \
    || die "Could not create an SSH key"

  log "Creating the VM"
  INSTANCE=""
  DEADLINE=$(( $(date +%s) + RETRY_MINUTES * 60 ))
  ROUND=0
  while [ -z "$INSTANCE" ]; do
    ROUND=$((ROUND + 1))
    for entry in "${SHAPES[@]}"; do
      SHAPE="${entry%%|*}"; shape="${entry#*|}"
      IMAGE=$(image_for "$SHAPE")
      [ -n "$IMAGE" ] || { echo "      No Ubuntu 24.04 image for $SHAPE here; skipping"; continue; }
      echo "$(date +%H:%M) attempt $ROUND: trying $SHAPE ${shape:-(fixed size)}"
      config=()
      [ -z "$shape" ] || config=(--shape-config "$shape")
      if OUT=$(oci compute instance launch --compartment-id "$C" --availability-domain "$AD" --display-name "$NAME" \
          --shape "$SHAPE" "${config[@]}" --image-id "$IMAGE" --subnet-id "$SUBNET" \
          --assign-public-ip true --boot-volume-size-in-gbs 50 \
          --user-data-file "$WORK/user-data.sh" --ssh-authorized-keys-file "$HOME/.ssh/$NAME.pub" \
          --wait-for-state RUNNING 2>"$WORK/launch.err"); then
        INSTANCE=$(jq -r '.data.id' <<<"$OUT")
        break
      fi
      if grep -qi "capacity" "$WORK/launch.err"; then
        echo "      Oracle is out of capacity for this size"
      elif grep -qi "LimitExceeded\|QuotaExceeded\|limit" "$WORK/launch.err"; then
        echo "      Your account's free allowance for this shape is used up (other servers use it)"
      elif grep -qi "TooManyRequests" "$WORK/launch.err"; then
        echo "      Oracle asked to slow down (too many requests); waiting a little longer"
        sleep 120
      else
        cat "$WORK/launch.err" >&2
        die "The VM could not be created (details above)"
      fi
      sleep 15  # don't hit Oracle's rate limit between shapes
    done
    [ -n "$INSTANCE" ] && break
    if [ "$(date +%s)" -ge "$DEADLINE" ]; then
      die "No free capacity right now. Re-run with RETRY_MINUTES=360 to keep trying, or USE_TRIAL_CREDITS=1 for an AMD server from the trial credits."
    fi
    WAIT=$(( ROUND < 5 ? 120 : 300 ))
    echo "      Trying again in $((WAIT / 60)) minutes (stops at $(date -d "@$DEADLINE" +%H:%M)). Keep this tab open."
    sleep "$WAIT"
  done
fi

# ------------------------------------------------------------------------------------------- result
IP=$(oci compute instance list-vnics --instance-id "$INSTANCE" | jq -r '.data[0]."public-ip" // empty')
[ -n "$IP" ] || die "The VM has no public IP yet; re-run this command in a minute"
SHAPE_NOW=$(oci compute instance get --instance-id "$INSTANCE" | jq -r '.data.shape')
URL="https://$NAME.${IP//./-}.sslip.io"

cat <<EOF

==================================================================
 Server: $NAME ($IP, $SHAPE_NOW)

 CivicFix is installing itself now. In about 15 minutes
 (30 on the 1 GB micro server) open:

     $URL

 Watch the installation (Ctrl+C to stop watching):
     ssh -i ~/.ssh/$NAME ubuntu@$IP 'sudo tail -f /var/log/civicfix-setup.log'

 Admin login: $ADMIN_EMAIL
 Password (when the log says "CivicFix is running"):
     ssh -i ~/.ssh/$NAME ubuntu@$IP 'sudo cat /root/civicfix-credentials.txt'
==================================================================
EOF
