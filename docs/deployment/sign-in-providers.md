# Sign-in providers

Email + password sign-in always works. The three methods below are optional; each is off until configured, and the admin portal and app only show a button for methods the server reports as switched on (`GET /api/auth/providers`).

| Method | Who can use it | Service | Configured by |
|---|---|---|---|
| Forgot password | Everyone with an email account | Amazon SES | `EMAIL_FROM` |
| Phone number + SMS code | Citizens (app) | Amazon SNS | `ENABLE_SMS` + DLT IDs |
| Google | Citizens (app), existing staff/admin (portal) | Google OAuth 2.0 | `GOOGLE_CLIENT_ID` + secret |

How these flows work internally is described in [Authentication](../architecture/authentication.md).

Email + password works out of the box. Each of these is off until you set it up; the admin portal and app only show a button once the server has it switched on. On AWS, all settings are **repository variables** (GitHub → Settings → Secrets and variables → Actions → **Variables**), followed by a redeploy (**Actions → Deploy to AWS → Run workflow**).

## Forgot password (email codes, Amazon SES)

1. AWS console → **Amazon SES** (same region as the deploy) → **Identities → Create identity**. Verify your domain (best) or a single sender address.
2. New SES accounts are in the *sandbox* and can only email verified addresses. Choose **Request production access** (usually approved within a day) before citizens use it.
3. Set variable `EMAIL_FROM` = the verified sender, e.g. `no-reply@yourcity.gov.in`.

## Sign in with a phone number (SMS codes, Amazon SNS)

1. AWS console → **Amazon SNS → Text messaging (SMS)**. New accounts are in the SMS sandbox: add your own number as a sandbox destination to test, then request to leave the sandbox and raise the monthly spend limit (the default is USD 1).
2. For Indian numbers, carriers require DLT registration: register a sender ID and a template on a DLT portal (Jio, Airtel, Vodafone Idea, BSNL). The template must match this message exactly, with the code as the variable:
   `{#var#} is your CivicFix sign-in code. It expires in 10 minutes. Do not share it.`
3. Set variables `ENABLE_SMS` = `true`, and `SMS_SENDER_ID`, `SMS_ENTITY_ID`, `SMS_TEMPLATE_ID` from your DLT registration.

## Sign in with Google

1. [Google Cloud console](https://console.cloud.google.com/apis/credentials) → **OAuth consent screen**: app name CivicFix, publish it.
2. **Credentials → Create credentials → OAuth client ID → Web application**. Under **Authorized redirect URIs** add `<API address>/api/auth/google/callback` (the API address from the deploy run's Summary).
3. AWS console → **Secrets Manager → Store a new secret → Other type of secret → Plaintext**, paste only the client secret, name it `civicfix/google-client-secret`. Copy its ARN.
4. Set variables `GOOGLE_CLIENT_ID` = the client ID and `GOOGLE_CLIENT_SECRET_ARN` = the ARN. The secret itself never goes into GitHub.

In the admin portal Google sign-in only works for people who already have a staff or admin account with the same email. In the app, new Google users become citizens.

The API sends email and SMS with its own AWS role (`civicfix-ecs-task`), which may only send email and SMS — no access keys are stored anywhere.

## Other hosts (Render, local)

Set the environment variables directly instead of repository variables: `EMAIL_PROVIDER=ses`, `EMAIL_FROM`, `SMS_PROVIDER=sns`, `SMS_*`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, plus `AWS_REGION`, `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` of an IAM user allowed only `ses:SendEmail` and `sns:Publish`. See the [configuration reference](../reference/configuration.md#sign-in-providers).

In local development the `log` providers are the default: codes are printed to the API's console (`[notify:email] …`, `[notify:sms] …`) instead of being sent.

## Checking it works

1. `curl <API URL>/api/auth/providers` shows `true` for the method.
2. The button appears on the sign-in screen (reopen the app or reload the portal).
3. Try it end to end with your own email, number or Google account.
4. If a code never arrives, check CloudWatch log group `/civicfix/api` for `notify` errors, the SES sending statistics, or SNS → Text messaging → Delivery logs.
