#!/bin/bash
# CivicFix: installs itself on an Oracle Cloud VM's first boot. Used by deploy/oracle-cloudshell-create.sh,
# which fills in ADMIN_EMAIL. You can also paste it by hand: Create instance -> Show advanced options ->
# Management -> Initialization script -> Paste cloud-init script (edit ADMIN_EMAIL first).
#
# No password is stored here: the script generates the admin password on the server and saves it to
# /root/civicfix-credentials.txt. Read it over SSH:  sudo cat /root/civicfix-credentials.txt
# Install log on the server: /var/log/civicfix-setup.log
ADMIN_EMAIL="you@example.com"

exec > /var/log/civicfix-setup.log 2>&1
set -u
echo "Started $(date -u)"

for attempt in $(seq 1 30); do  # the network can take a moment on first boot
  if curl -fsSL https://raw.githubusercontent.com/santhosh12133/CivicGuardAI/main/deploy/setup-server.sh \
      -o /root/civicfix-setup.sh; then
    break
  fi
  echo "Download attempt $attempt failed; retrying"; sleep 10
done
[ -s /root/civicfix-setup.sh ] || { echo "ERROR: could not download setup-server.sh"; exit 1; }

bash /root/civicfix-setup.sh --mode standalone --admin-email "$ADMIN_EMAIL"
status=$?
echo "Finished $(date -u) with exit code $status"
