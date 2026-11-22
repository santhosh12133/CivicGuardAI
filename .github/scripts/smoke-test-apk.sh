#!/usr/bin/env bash
# Installs the APK on a running emulator, launches it, and fails if the app
# crashes or never reaches the login screen. Used by .github/workflows/android-apk.yml.
set -euo pipefail

APK="$1"
PACKAGE="com.civicfix.app"
OUT="${2:-smoke-test-output}"
mkdir -p "$OUT"

adb wait-for-device
adb logcat -c
adb install -r "$APK"
adb shell monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1 >/dev/null

# Release builds load the JS bundle and fonts on first start; give it time.
found=""
for _ in $(seq 1 30); do
  sleep 3
  if ! adb shell pidof "$PACKAGE" >/dev/null 2>&1; then
    echo "::error::$PACKAGE is no longer running"
    break
  fi
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || continue
  # Login screen (server built in) or the server screen (asked on first launch).
  if adb shell cat /sdcard/ui.xml | grep -Eq "Create an account|Connect to your CivicFix server"; then
    found="yes"
    break
  fi
done

adb exec-out screencap -p > "$OUT/screen.png" || true
adb shell cat /sdcard/ui.xml > "$OUT/ui.xml" 2>/dev/null || true
adb logcat -d > "$OUT/logcat.txt" || true

if grep -E "FATAL EXCEPTION|ReactNativeJS.*(Error|Exception)" "$OUT/logcat.txt" | grep -v "health check failed" > "$OUT/errors.txt"; then
  echo "::error::The app logged a crash or JavaScript error on launch:"
  head -40 "$OUT/errors.txt"
  exit 1
fi

if [ -z "$found" ]; then
  echo "::error::Neither the login nor the server screen appeared within 90 seconds"
  grep -E "ReactNativeJS|AndroidRuntime" "$OUT/logcat.txt" | tail -40 || true
  exit 1
fi

echo "App launched and showed its first screen."
