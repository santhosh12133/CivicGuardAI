# Glossary

| Term | Meaning |
|---|---|
| **Access token** | Short-lived (15 min) JWT sent as `Authorization: Bearer …` on every request. See [Authentication](../architecture/authentication.md) |
| **Admin** | Role with every staff permission plus deleting issues and managing accounts |
| **Admin portal** | The React web app staff and admins use (`admin/`) |
| **APK** | Android installation file. CivicFix publishes it under GitHub Releases |
| **Category** | Kind of problem: pothole, road damage, streetlight, garbage, water supply, drainage, traffic signal, fallen tree, other |
| **Citizen** | Role for members of the public; created by self sign-up |
| **CORS** | Browser rule controlling which websites may call the API; configured with `CORS_ORIGINS` |
| **DLT** | India's Distributed Ledger Technology registration required for commercial SMS (sender ID, entity ID, template ID) |
| **ECS Express Mode** | AWS service that runs the API container with HTTPS, load balancing and scaling |
| **Evidence checks** | Server-side checks on a report's photo: metadata, capture date, location, duplicates. See [Evidence validation](../architecture/evidence-validation.md) |
| **EXIF** | Metadata embedded in photos: camera, capture time, GPS position |
| **Hand-over code** | Single-use, 2-minute code the API gives the app or portal after Google sign-in, exchanged for tokens |
| **Issue / report** | A citizen's report of a problem, with photo, location, category and status |
| **Lockout** | 15-minute block on password sign-in after five wrong passwords |
| **Needs review** | Flag on an issue whose evidence could not be fully confirmed, or that resembles an existing report |
| **OIDC** | OpenID Connect. GitHub Actions uses it to sign in to AWS without stored keys |
| **OTP** | One-time code sent by email or SMS |
| **pHash** | Perceptual hash: a fingerprint of how an image looks, used to spot near-duplicate photos |
| **Refresh token** | Long-lived random token used only to obtain new access tokens; rotates on every use |
| **Resolution photo** | Photo staff attach when resolving an issue, shown to the citizen |
| **Reverse geocoding** | Turning coordinates into an address (OpenStreetMap Nominatim) |
| **Session** | A signed-in device. Stored in the `sessions` table; can be ended remotely |
| **SES / SNS** | Amazon Simple Email Service / Simple Notification Service, used to send codes |
| **Staff** | Role for municipal officers: view and update issues, see reporters |
| **Status** | `Open` → `In Progress` → `Resolved` |
| **Timeline** | Public history of an issue: report, status changes, notes, resolution photo (`issue_updates`) |
| **RPO / RTO** | Recovery point / time objective: how much data may be lost, and how long recovery may take, after a failure |
