# Google Play — manual submission checklist

Everything here has **no API**. `fastlane supply` cannot create the app, cannot perform the
first upload, and cannot answer any of the policy forms. Do these by hand once; afterwards
`fastlane android release` handles subsequent releases.

Artifact to upload: `android/app/build/outputs/bundle/release/app-release.aab`
(3.6 MB, signed with `android/keystores/salo-release.jks`, versionCode 5 / versionName 1.0.4)

---

## 1. Create the app
Play Console → **Create app**
- App name: `صلِّ على محمد ﷺ`
- Default language: Arabic
- App or game: **App** · Free or paid: **Free**

## 2. Store listing
Paste from `fastlane/metadata/android/`:

| Field | File |
|---|---|
| Short description | `ar/short_description.txt` |
| Full description | `ar/full_description.txt` |
| App icon (512×512) | `images/icon.png` |
| Feature graphic (1024×500) | `images/featureGraphic.jpg` |
| Phone screenshots (4) | `images/phoneScreenshots/*.jpg` |

Add English (US) as a second language using `en-US/`.

## 3. Declarations that will be asked — and how to answer

These are the parts most likely to get this specific app held or rejected.

### Foreground service — `FOREGROUND_SERVICE_SPECIAL_USE`  ⚠ highest risk
Play asks for a written justification and a demo video. `specialUse` is the catch-all type and
Google reviews it manually; the declared subtype is `unlock_listener`.

Justification to give:
> The app's single purpose is to display a short reminder to send Salawat on the Prophet when
> the user unlocks their device. A foreground service is required to receive
> `ACTION_USER_PRESENT`, which is not deliverable to a manifest-registered receiver on Android 8+.
> No data is collected, transmitted, or stored off-device. The service does nothing else.

If Google rejects `specialUse`, the fallback is to move the reminder to `AlarmManager` +
notifications and drop the unlock trigger on Android.

### Display over other apps — `SYSTEM_ALERT_WINDOW`
Declare that the overlay is the core user-facing feature, is user-triggered by unlocking,
is dismissible, and never covers system UI or another app's sensitive input.

### Battery optimization — `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`  ⚠ policy-restricted
Google restricts this permission to a short list of app categories. A reminder app is **not**
clearly on that list. Two options:
- Declare it as required for reliable unlock detection on OEMs that kill background services, or
- **Remove it** (`AndroidManifest.xml:64` + `OverlayPlugin.java:76`) and accept reduced
  reliability on Xiaomi/Huawei/Oppo. This is the safer path if you want a clean first review.

### Exact alarms — `SCHEDULE_EXACT_ALARM`
Used only for the "pause until" resume in `OverlayPlugin.java:143-151`. Play requires a
declaration. If you would rather avoid the form, switch those three calls to `setAndAllowWhileIdle`
and drop the permission — the resume does not need second-level precision.

### Data safety form
Answer: **no data collected, no data shared.** The app has no backend, no analytics, no ads,
no account. Everything lives in `SharedPreferences` on-device.

### Content rating questionnaire
Category: Reference / Books. No violence, no user content, no ads, no purchases.

### Target audience
13+ (avoid the "designed for children" track — it adds a much stricter review).

### App access
"All functionality is available without special access" — there is no login.

### Ads
No ads.

### Privacy policy URL
Arabic listing: `https://sallialamuhammad.com/ar/privacy`
English listing: `https://sallialamuhammad.com/en/privacy`

Both verified live (HTTP 200, last updated 14 Aug 2026). The policy already covers
the overlay, foreground service, AlarmManager/WorkManager, iOS local notifications,
the unused `INTERNET` permission, and under-13 users — it matches the "no data
collected" Data safety answer above, so the two will not contradict each other.

Optional but worth filling in: Play's data-deletion field accepts
`https://sallialamuhammad.com/ar/delete-data` (also live).

## 4. Release
Production → Create new release → upload the AAB → paste release notes → roll out.

---

## Open items you must supply

1. **Google Play service-account JSON** — only needed to automate *future* releases via
   `fastlane supply`. Play Console → Setup → API access → create service account with
   "Release manager", download the JSON, then `export SUPPLY_JSON_KEY=/path/to.json`.

## After the listing goes live

`sallialamuhammad.com` currently links to
`https://play.google.com/store/apps/details?id=com.salo.alahmuhammed`, which **404s**
today because the app is not published yet. It will start resolving once the release
rolls out. The App Store button on the site still says "coming soon" and will need the
real link after Apple approves.

## Time-sensitive

`targetSdkVersion` is **35** (`android/variables.gradle:4`). Google Play requires **API 36**
for all new apps and updates submitted **on or after 31 Aug 2026** — 10 days from now.
Submitting today at 35 is accepted; the *next* update will be rejected until you bump to 36.
Note that API 36 also forbids locking orientation/aspect on screens ≥600dp.

## Known listing risk

The supplied screenshots are marketing renders that use an **iPhone device frame**. Play flags
Android listings that present iOS device frames. The images are otherwise compliant
(1400×2778, ratio 1.98, JPEG, no alpha). Consider re-rendering these four panels in an Android
frame — or frameless — before or shortly after the first submission.
