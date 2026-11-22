# Android app releases

Citizens install CivicFix as an APK downloaded from the repository's **Releases** page. The [AWS deploy](aws.md) builds one automatically; this page covers building one by hand, signing, versioning and updates.

The APK is built by GitHub Actions (`.github/workflows/android-apk.yml`): it builds a signed release APK, starts it on an Android emulator to check it reaches the login screen, and publishes it as a GitHub Release so citizens get a download link.

## One-time: add the signing key

Android only installs an update over an existing app if both are signed with the **same key**. Add these in GitHub → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | contents of `keystore.base64.txt` |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password |
| `ANDROID_KEY_ALIAS` | `civicfix` |
| `ANDROID_KEY_PASSWORD` | the keystore password (same value) |

Keep a backup of the keystore file and password somewhere safe outside GitHub. If the key is lost, people have to uninstall the app before they can install a newer build.

Optional: `GOOGLE_MAPS_API_KEY` (an Android Maps SDK key from Google Cloud) shows a map on the report screen. Without it the app shows the coordinates and an "Open in Maps" link instead.

## Build and publish

1. GitHub → **Actions → Android APK → Run workflow**.
2. **api_url:** your API URL **without** `/api`, e.g. `https://civicfix-api.onrender.com`. If you leave it empty, the app asks for the server address on first launch (people can also change it from the login screen).
3. Keep **publish** ticked and run. It takes about 25–35 minutes.
4. When it finishes, open **Releases**: the newest `CivicFix-v…-build….apk` is the file to share. Send citizens the release link, or the direct link to the `.apk`.

Citizens install it by opening the downloaded file and allowing installs from their browser/file manager when Android asks. Each new build installs over the previous one.

Pushing a git tag named `mobile-v…` (e.g. `mobile-v1.0.1`) also builds and publishes, without a built-in server address. Without the signing secrets, any published build is marked as a **test pre-release** signed with a public debug key; uninstall it before installing an official build.

Rebuild whenever the API URL changes, if you built it in. Changes to the API or admin portal alone do not need a new APK.

## Alternative: Expo EAS Build

`mobile/eas.json` still works if you prefer Expo's build service (needs an Expo account):

```bash
cd mobile
npx eas env:set --name EXPO_PUBLIC_API_URL --value <API URL> --environment preview --visibility plaintext
npx eas build --platform android --profile preview   # installable APK
```

## Versions and updates

- The version name comes from `mobile/app.json` (`expo.version`). Raise it for user-visible releases and record the change in `CHANGELOG.md`.
- The workflow sets `versionCode` from the run number (`ANDROID_VERSION_CODE`), so every build installs over the previous one.
- Citizens need a new APK only when `mobile/` changes or the built-in API address changes. API and admin portal changes are picked up without an app update.

## Server address

An APK built with an `api_url` connects to that server. Without one, the app asks for the server address on first launch; it can also be changed from **Login → Server** (useful for testing against a staging API). The address is stored on the phone.
