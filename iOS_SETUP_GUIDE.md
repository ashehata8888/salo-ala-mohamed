# iOS Setup Guide

The iOS app has two reminder surfaces:

1. **Local notifications** — recurring hourly Salawat reminders. Fully wired in
   JavaScript (`@capacitor/local-notifications`); `npx cap sync ios` installs the
   native plugin automatically. **No manual Xcode work is needed for notifications.**
2. **Home-screen widget** — a WidgetKit widget showing a rotating phrase. The widget
   target is **not** managed by `cap sync` and must be added manually in Xcode (below).

The canonical App Group ID is **`group.com.salo.alahmuhammed`** — it matches the
`appId` (`com.salo.alahmuhammed`) and the `suiteName` literal in `WidgetExtension.swift`.
Use this exact ID everywhere.

## 1. Build & sync

```
npm install
npm run build
npx cap sync ios
```

Confirm `@capacitor/local-notifications` now appears in
`ios/App/CapApp-SPM/Package.swift`.

## 2. Add the Widget Extension target (manual)

Modifying `.pbxproj` via automation can corrupt the Xcode project, so add the widget
target by hand:

1. Open Xcode: `npx cap open ios` (or open `ios/App/App.xcworkspace`).
2. **File → New → Target…**
3. Select **Widget Extension**, click **Next**.
4. Product Name: `WidgetExtension`.
5. Leave **Include Live Activity** and **Include Configuration App Intent** **unchecked**. Click **Finish**.
6. If prompted to activate the scheme, click **Activate**.
7. Delete the auto-generated `WidgetExtension.swift` (and bundle file) inside the new group.
8. Right-click the `WidgetExtension` group → **Add Files to "WidgetExtension"…**
9. Select `ios/App/WidgetExtension/WidgetExtension.swift`. Ensure the **only** checked
   target is `WidgetExtension`.

## 3. Enable App Groups (both targets)

The widget reads `user_lang` from the shared App Group; the app writes it there via
`Preferences.configure({ group })` in `src/main.tsx`.

**The App target is already wired** — `ios/App/App/App.entitlements` exists with
`group.com.salo.alahmuhammed`, and `CODE_SIGN_ENTITLEMENTS` points at it in both Debug and
Release. Adding the capability in Xcode will pick up the existing file rather than create a
new one. You still need to:

1. Register the App Group **`group.com.salo.alahmuhammed`** in the Developer portal under
   team **V4RS9SZH59** (Kortobaa Integrated Solutions LLC), and enable it on the
   `com.salo.alahmuhammed` App ID. Until that exists, automatic signing fails with a
   "provisioning profile does not include the com.apple.security.application-groups
   entitlement" error.
2. **WidgetExtension** target → **Signing & Capabilities** → **+ Capability** → **App Groups**
   → add the **same** group.

## 4. Version

iOS is in step with Android (`versionName 1.0.3`, `versionCode 4`):

- **App** target: `MARKETING_VERSION = 1.0.3`, `CURRENT_PROJECT_VERSION = 4`
  (already set in `project.pbxproj`, both configurations).
- **WidgetExtension** target → set the same `MARKETING_VERSION = 1.0.3` and
  `CURRENT_PROJECT_VERSION = 4` so the embedded extension matches the host app. A mismatch
  here is rejected at upload.

`ITSAppUsesNonExemptEncryption = false` is set in `Info.plist`, so TestFlight will not ask
for export-compliance answers on each build.

## 5. Run

Build & run on a simulator or device. Grant the notification permission prompt on first
launch, then add the **Salah Reminder** widget to the home screen.

## Production checklist

- **Bundle Identifier** — set consistently on both the App and WidgetExtension targets.
- **App Group ID** — `group.com.salo.alahmuhammed` must be registered for your team in
  the Apple Developer portal. If you change it, also update the `suiteName` literal in
  `WidgetExtension.swift` and the `Preferences.configure` call in `src/main.tsx`.
- **Notifications** — local notifications need no entitlement; the runtime permission
  prompt is requested automatically by the app.
- **Offline phrases** — the widget embeds its own phrase pool for offline rendering;
  notification phrases come from the web `salahPhrases` / `salahPhrasesEn` arrays.
- **Battery** — notifications are scheduled in a rolling 60-item batch and topped up on
  each app launch; the widget refreshes on its own WidgetKit timeline.
