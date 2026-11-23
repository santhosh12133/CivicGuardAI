#!/usr/bin/env bash
# Runs the Maestro flows in e2e/mobile on a booted emulator.
#   mobile-e2e.sh <apk> <gallery-photo.jpg> <seed.json> <output-dir>
set -uo pipefail

APK="$1"; PHOTO="$2"; SEED="$3"; OUT="$(realpath -m "$4")"
FLOWS="$(realpath e2e/mobile)"
mkdir -p "$OUT"

adb wait-for-device
adb install -r "$APK"

# Same place as the seeded reports (Bengaluru), for the "report an issue" flow.
adb emu geo fix 77.5946 12.9716 || true

# Put a fresh, camera-stamped photo in the gallery and get it indexed.
adb push "$PHOTO" /sdcard/Pictures/civicfix-e2e.jpg
adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Pictures/civicfix-e2e.jpg >/dev/null 2>&1 || true
adb shell content call --uri content://media --method scan_volume --arg external_primary >/dev/null 2>&1 || true
sleep 5
echo "Gallery contents:"
adb shell content query --uri content://media/external/images/media --projection _display_name || true

env_args=(
  -e "ASHA_EMAIL=$(jq -r .asha.email "$SEED")"
  -e "ASHA_PASSWORD=$(jq -r .asha.password "$SEED")"
  -e "RAVI_EMAIL=$(jq -r .ravi.email "$SEED")"
  -e "RAVI_PASSWORD=$(jq -r .ravi.password "$SEED")"
  -e "TEST_PHONE_NUMBER=${TEST_OTP_PHONE#+91}"
  -e "TEST_PHONE_CODE=${TEST_OTP_CODE}"
)

failed=()
cd "$OUT"   # takeScreenshot writes here
for flow in "$FLOWS"/0*.yaml; do
  name="$(basename "$flow" .yaml)"
  echo "::group::$name"
  adb logcat -c || true
  adb emu geo fix 77.5946 12.9716 >/dev/null 2>&1 || true
  # Close any system "isn't responding" dialog left from the previous flow.
  adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null 2>&1 || true
  adb shell input keyevent KEYCODE_HOME >/dev/null 2>&1 || true
  # Emulators on shared CI machines are sometimes slow to start an app, so
  # each flow gets one retry; the log says when a retry was needed.
  # A new address per attempt: a retry must not trip over the account the first attempt created.
  if maestro test "${env_args[@]}" -e "NEW_EMAIL=meera.$(date +%s%N)@example.com" --debug-output "$OUT/debug-$name" "$flow"; then
    echo "PASSED: $name"
  elif echo "::warning::Retrying $name once" && \
       maestro test "${env_args[@]}" -e "NEW_EMAIL=meera.$(date +%s%N)@example.com" --debug-output "$OUT/debug-$name-retry" "$flow"; then
    echo "PASSED: $name (on retry)"
  else
    echo "::error::Mobile flow failed: $name"
    failed+=("$name")
    echo "Screen at the time of failure (text and ids):"
    maestro hierarchy 2>/dev/null \
      | jq -r '.. | .attributes? // empty | [(.text // ""), (."resource-id" // ""), (.accessibilityText // "")] | map(select(. != "")) | join(" | ")' 2>/dev/null \
      | grep -v '^$' | head -60 || true
    echo "App log:"
    adb logcat -d -s ReactNativeJS:V AndroidRuntime:E 2>/dev/null | tail -30 || true
    echo "Native errors:"
    adb logcat -d 2>/dev/null | grep -iE "exception|okhttp|networking" | grep -v "^--" | tail -30 || true
    if [ -n "${API_LOG:-}" ] && [ -f "$API_LOG" ]; then
      echo "API server log (last lines):"
      tail -40 "$API_LOG"
    fi
  fi
  adb logcat -d > "$OUT/logcat-$name.txt" 2>/dev/null || true
  adb exec-out screencap -p > "$OUT/end-$name.png" 2>/dev/null || rm -f "$OUT/end-$name.png"
  echo "::endgroup::"
done

if [ ${#failed[@]} -gt 0 ]; then
  echo "Failed flows: ${failed[*]}"
  exit 1
fi
echo "All mobile flows passed."
