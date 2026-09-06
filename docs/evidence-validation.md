# Evidence Validation

## 1. Purpose

CivicGuardAI treats submitted photos as untrusted evidence. The backend applies multiple independent checks before an issue is persisted.

## 2. Validation pipeline

```text
Client upload
    |
    v
MIME/extension/size validation
    |
    v
EXIF inspection
    |
    +--> meaningful metadata?
    |
    v
Photo timestamp
    |
    +--> valid timestamp?
    +--> age <= configured rule?
    |
    v
GPS extraction / fallback
    |
    +--> valid coordinates?
    +--> compare with reported location
    |
    v
Perceptual hash
    |
    +--> similar existing images?
    |
    v
Persist issue + review signal
```

## 3. File validation

The upload layer accepts image MIME types including JPEG, PNG, GIF, and WebP and limits multipart uploads to one file and 10 MB. fileciteturn256file0L2-L4

Generated filenames use server-side randomization rather than trusting an uploaded filename. fileciteturn256file0L2-L4

## 4. EXIF validation

For an uploaded image, ExifTool reads metadata. The implementation looks for camera make/model, `DateTimeOriginal`, and GPS-related fields. An image without significant metadata can be rejected; the application also supports some gallery-photo fallback behavior. fileciteturn263file0L2-L2

Important limitation: EXIF metadata is not cryptographic proof that a photograph was captured at the claimed time or location. Metadata can be stripped or manipulated.

## 5. Photo-date rule

The current controller prefers `DateTimeOriginal`, falling back to `FileModifyDate` where appropriate. The current hard-coded maximum age is 24 hours. fileciteturn263file0L2-L2

This should eventually become an explicit configuration or product policy rather than a hidden constant.

## 6. GPS validation

The controller attempts multiple GPS formats and applies hemisphere references. It then compares photo coordinates with the reported device coordinates using `geolib` distance calculation. The current rejection threshold is 200 meters. fileciteturn263file0L2-L2

The implementation can fall back to device coordinates in cases where an image does not expose usable embedded GPS. Therefore, the presence of a stored issue does not guarantee that independently verified photo GPS existed.

## 7. Reverse geocoding

The API attempts to reverse-geocode submitted coordinates into a human-readable address. Geocoding is enrichment only; latitude and longitude remain the authoritative location fields.

External provider failures should not turn valid coordinates into silently incorrect locations. The system should surface a missing-address condition rather than inventing precision.

## 8. Duplicate-image detection

The application computes a perceptual hash (`pHash`) for uploaded images and compares it to stored hashes. The current implementation uses a 90% similarity threshold to flag likely duplicates for manual review rather than automatically rejecting the report. fileciteturn263file0L2-L2

This is intentionally a review signal:

```text
similar image found
      |
      v
needs_review = true
      |
      v
human investigation
```

It is not proof that two reports are fraudulent or submitted by the same person.

## 9. False positives and false negatives

| Control | Possible false positive | Possible false negative |
|---|---|---|
| EXIF presence | Edited but metadata-rich image | Valid platform removes metadata |
| Photo age | Clock/timezone anomalies | Modified timestamps |
| GPS distance | Poor device accuracy | Manipulated GPS metadata |
| pHash | Same scene photographed again | Cropped/rotated/low-quality duplicates missed |
| Reverse geocoding | Ambiguous address | Provider failure |

Human review is required for ambiguous cases.

## 10. Evidence handling requirements

Do not log complete EXIF payloads, uploaded binary content, authorization tokens, or sensitive user information. Production observability must retain only the minimum metadata needed for troubleshooting and audit.

## 11. Future hardening

Recommended production enhancements:

- cryptographic object-storage integrity checks;
- malware scanning before processing;
- image re-encoding to a safe canonical format;
- asynchronous evidence processing for large files;
- explicit confidence/review reasons;
- geolocation accuracy radius from the device;
- configurable regional distance thresholds;
- representative test corpus from real Android/iOS devices;
- immutable audit records for moderation decisions.
