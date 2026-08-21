# Google Play — submission checklist (Arabic-only listing)

Artifact: `build/SaloAlaMohamed-1.0.4-5.aab`
3.6 MB · signed with `android/keystores/salo-release.jks` · versionCode 5 · versionName 1.0.4

None of the steps below have an API. `fastlane supply` cannot create the app, cannot
perform the first upload, and cannot answer any policy form. Do this once by hand;
from release #2 onwards `fastlane android release` handles it.

---

## 0. CHECK THIS FIRST — it decides whether you can ship today

Play Console → **Settings → Developer account → Account details**

| Account type | Consequence |
|---|---|
| **Organization** | Exempt. Publish straight to production today. |
| **Personal**, created **before** 13 Nov 2023 | Exempt. Publish today. |
| **Personal**, created **after** 13 Nov 2023 | **Blocked.** You must run a closed test with **12 testers opted in continuously for 14 days** before production access is granted. |

If you fall in the third row there is no way around it — plan for a closed track
today and production in two weeks. Recruit 14–15 testers rather than exactly 12, and
make sure they actually open the app; installs alone do not count.

---

## 1. Create the app

- App name: `صل على محمد`
- Default language: **Arabic**
- App or game: **App** · Free or paid: **Free**
- Declarations: confirm it meets Play policies and US export laws

## 2. Store listing — Arabic only

| Field | Source |
|---|---|
| App name (30) | `fastlane/metadata/android/ar/title.txt` |
| Short description (80) | `fastlane/metadata/android/ar/short_description.txt` |
| Full description (4000) | `fastlane/metadata/android/ar/full_description.txt` |
| App icon 512×512 | `fastlane/metadata/android/images/icon.png` |
| Feature graphic 1024×500 | `fastlane/metadata/android/images/featureGraphic.jpg` |
| Phone screenshots (4) | `fastlane/metadata/android/images/phoneScreenshots/*.jpg` |

Do **not** add an English listing. The English phrase pool is 6 entries against 332
Arabic; the English metadata is parked in `fastlane/deferred-english/` for a later
release.

The feature graphic is required — the listing will not publish without it.

## 3. App content — every section must be green

### Privacy policy
`https://sallialamuhammad.com/ar/privacy`

### Data safety
- Does your app collect or share any required user data types? → **No**
- Is all data encrypted in transit? → n/a (nothing is transmitted)
- Do you provide a way to delete data? → n/a

The app has no backend, no analytics, no ads and no account. Everything lives in
`SharedPreferences` on-device. This matches the published policy, which Google
cross-checks.

### Content rating (IARC questionnaire)
Category **Reference / Books**. No violence, sexuality, profanity, gambling,
user-generated content, ads or purchases. Expected outcome: rated for everyone.

### Target audience
Age **13+**. Do not select an under-13 bracket — it pulls the app into Families
policy and a much stricter review for no benefit here.

### Ads
Contains ads → **No**

### App access
**All functionality is available without special access** — there is no login.

### Government apps / Financial features / Health
No to all.

## 4. Permission declarations — the risky part

### `FOREGROUND_SERVICE_SPECIAL_USE` ⚠ highest rejection risk
Google reviews `specialUse` manually and may ask for a demo video. Declared subtype
is `unlock_listener`.

> The app's single purpose is to display a short reminder to send Salawat on the
> Prophet when the user unlocks their device. A foreground service is required to
> receive `ACTION_USER_PRESENT`, which is not deliverable to a manifest-registered
> receiver on Android 8+. No data is collected, transmitted, or stored off-device.
> The service performs no other work.

If Google rejects it, the fallback is to drop the unlock trigger on Android and move
the reminder to `AlarmManager` + notifications.

### `SYSTEM_ALERT_WINDOW` (Display over other apps)
Declare that the overlay *is* the core user-facing feature, is triggered by the user
unlocking their own device, dismisses itself after a few seconds, and never covers
system UI or another app's sensitive input.

### `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` ⚠ policy-restricted
Google limits this permission to a short list of app categories and a reminder app is
not clearly on it. Two options:
- Declare it as required for reliable unlock detection on OEMs that aggressively kill
  background services, or
- **Remove it** — `AndroidManifest.xml:64` and `OverlayPlugin.java:76` — and accept
  reduced reliability on Xiaomi/Huawei/Oppo. Safer for a first review.

Related: the app currently *forces* this permission. Declining it leaves the user
stuck in onboarding, unable to reach the app at all (`src/App.tsx:343`). If you keep
the permission, consider making that gate skippable before review.

### `SCHEDULE_EXACT_ALARM`
Used only for the pause-resume in `OverlayPlugin.java:143-151`. Requires a
declaration. To avoid the form entirely, switch those calls to
`setAndAllowWhileIdle` and drop the permission — the resume does not need
second-level precision.

## 5. Release

Production (or Closed testing, per step 0) → Create new release → upload the AAB →
release notes → roll out.

---

## Time-sensitive

`targetSdkVersion` is **35** (`android/variables.gradle:4`). Google Play requires
**API 36** for all new apps and updates submitted **on or after 31 Aug 2026**.
Submitting before that date is accepted; the next update will be rejected until you
bump. API 36 also forbids locking orientation/aspect on screens ≥600dp.

## Known listing weakness

The four phone screenshots are marketing renders using an **iPhone device frame**.
Google flags Android listings that present iOS frames. They are otherwise compliant
(1400×2778, ratio 1.98, JPEG, no alpha). Re-render in an Android frame — or capture
real Android screenshots, which also lets you show the unlock overlay, the actual
hero feature.

## After the listing is live

In `salahapp-web/src/lib/config.ts` set `androidPublished: true` and redeploy, so the
Play badge stops rendering as "coming soon".
