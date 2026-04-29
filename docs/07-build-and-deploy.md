# 07 — Build & Deploy

## Prerequisites

- **Node.js 18+** (Vite 8 requires ≥18)
- **JDK 17** (Android Gradle Plugin 8.2.1 needs Java 17)
- **Android SDK** with platforms 35 + build-tools 35
- **Xcode 15+** with iOS 17+ SDK (for the Widget Extension)
- **CocoaPods** is **not** required — Capacitor 7 uses SPM on iOS

## Web build

| Command | What it does |
|---------|--------------|
| `npm install` | Install JS deps |
| `npm run dev` | Vite dev server (browser-only; native plugins are no-ops) |
| `npm run build` | TypeScript-aware Vite build → `dist/` |
| `npm run preview` | Serve the built `dist/` for sanity check |
| `npm run lint` | ESLint over `**/*.{js,jsx}` only — TS files are skipped |

There is **no** `npm test` and no type-check script. To type-check manually:

```
npx tsc --noEmit
```

## Android

| Command | What it does |
|---------|--------------|
| `npm run android:sync` | `vite build` + `npx cap sync android` (copies `dist/` into `android/app/src/main/assets/public/` and updates plugin manifest) |
| `npm run android:copy` | `npx cap copy android` — re-copies webDir without re-running plugin sync |
| `npm run android:open` | `npx cap open android` — opens Android Studio |
| `npm run android:run` | sync + open in one step |

The `clean`, `bapk`, `devm` scripts in `package.json` use Windows-only commands (`rmdir /s /q`, `gradlew.bat`, backslash paths). On macOS use:

```
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

For a release build, configure signing via `android/app/build.gradle` (no signing config exists yet — you'd add one).

### Gradle versions

- AGP `8.2.1` (`android/build.gradle`)
- Gradle wrapper version: check `android/gradle/wrapper/gradle-wrapper.properties` (not read here; AGP 8.2.x → Gradle 8.2+)
- ProGuard rules in `android/app/proguard-rules.pro`; `minifyEnabled = false` for release — meaning code is **not** minified or obfuscated. You'd need to flip this and verify the overlay still works (reflection paths, plugin annotations) before publishing.

### google-services.json

The Android build **conditionally** applies the Google Services plugin if `android/app/google-services.json` exists. Today there is no such file → push notifications won't work, which is fine because the app doesn't use FCM.

## iOS

| Command | What it does |
|---------|--------------|
| `npx cap sync ios` | Updates webDir + plugin pods/SPM packages |
| `npx cap open ios` | Opens Xcode workspace at `ios/App/App.xcworkspace` |

In Xcode:
- **App** scheme builds and runs the host app (settings UI in webview).
- **WidgetExtension** scheme builds the widget — **only after the manual setup steps in `iOS_SETUP_GUIDE.md` are complete**.
- Both targets need:
  - Bundle identifier set per your team
  - App Group `group.com.salo.alahmoha` enabled in Signing & Capabilities

For TestFlight / App Store:
- Bump `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` in the Xcode project (these become `CFBundleShortVersionString` and `CFBundleVersion` via Info.plist substitution).
- Make sure both `App` and `WidgetExtension` targets share the same versioning.
- Archive → Distribute via Xcode Organizer.

## Capacitor sync — what happens

When you run `npx cap sync`:

1. Copies `dist/` into `android/app/src/main/assets/public/` and `ios/App/App/public/`.
2. Updates Capacitor plugin registrations:
   - Android: regenerates `capacitor.build.gradle` + `capacitor.settings.gradle` from `node_modules`
   - iOS: updates SPM packages
3. **Does not touch your custom Java code** (`OverlayPlugin.java` etc.) or your iOS `WidgetExtension/`.

If you ever see a sync wipe out a file, it's because that file was at a path Capacitor manages (e.g. `assets/public/`). The custom Java in `com/salo/alahmoha/` and `WidgetExtension.swift` are safe.

## Common build pitfalls

| Symptom | Likely cause |
|---------|--------------|
| `Could not find com.android.tools.build:gradle:8.2.1` | JDK is too old; needs JDK 17 |
| Splash screen stuck or app crashes on launch | Missing `compileSdk = 35` artifacts — install via SDK Manager |
| Service starts but overlay never shows | `SYSTEM_ALERT_WINDOW` not granted (check Android system Settings → Apps → Salah → Display over other apps) |
| Service dies after 5–10 minutes | OEM battery optimizer killed it. Add an in-app prompt to whitelist the app from the OEM's "Auto-start" / "Battery saver" exception list. |
| Widget shows placeholder forever | `WidgetExtension` target missing the App Group capability, or the `@main` annotation got removed |
| Widget shows English text but app is in Arabic | The known sync gap — see [08-known-issues.md](./08-known-issues.md) |

## CI / CD

There is no CI configured (no `.github/workflows`, no `bitrise.yml`, no `fastlane/`). All builds are manual.

## File outputs

- Android debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- Android release AAB: `android/app/build/outputs/bundle/release/app-release.aab` (after signing config + `bundleRelease` task)
- iOS archive: managed by Xcode Organizer
