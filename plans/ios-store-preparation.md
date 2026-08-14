# iOS App Store Preparation Plan

## Status: In Progress (CLI changes done, manual Xcode steps remaining)

## Completed (via CLI)

### 1. Package Name & Bundle ID
- [x] `capacitor.config.json` appId → `com.salo.alahmuhammed`
- [x] `project.pbxproj` PRODUCT_BUNDLE_IDENTIFIER → `com.salo.alahmuhammed` (Debug + Release)
- [x] `WidgetExtension.swift` App Group suiteName → `group.com.salo.alahmuhammed`

### 2. App Identity
- [x] `Info.plist` CFBundleDisplayName → "صلِّ على محمد ﷺ" (Arabic app name)
- [x] `Info.plist` CFBundleDevelopmentRegion → "ar" (Arabic-first)
- [x] `project.pbxproj` developmentRegion → "ar"
- [x] `project.pbxproj` knownRegions → added "ar"

### 3. Build Configuration
- [x] Created `ios/release.xcconfig` with `CAPACITOR_DEBUG = false`
- [x] Wired release.xcconfig into Release build configs (project + target level)
- [x] Fixed deprecated `CODE_SIGN_IDENTITY` → "Apple Development"
- [x] Rebuilt web + ran `cap sync ios`

---

## Remaining (Manual — requires Xcode UI)

### Step 1: Open the project
```
npx cap open ios
```

### Step 2: Re-add WidgetExtension target
The widget target was added on a different machine and is not in the pbxproj. It needs to be recreated:

1. Select the App project in navigator
2. File → New → Target → Widget Extension
3. Product Name: `WidgetExtension`
4. Uncheck "Include Live Activity"
5. Finish
6. Delete the auto-generated `WidgetExtension.swift` content
7. Copy the existing code from `ios/App/WidgetExtension/WidgetExtension.swift` into the new target
8. Set the WidgetExtension target's bundle ID to `com.salo.alahmuhammed.WidgetExtension`
9. Set deployment target to iOS 15.0+ (match main app)
10. Ensure WidgetExtension's `SWIFT_VERSION` = 5.0

### Step 3: Configure App Groups (entitlements)
Both targets need the same App Group so they can share UserDefaults:

**For the App target:**
1. Select App target → Signing & Capabilities tab
2. Click "+ Capability" → search "App Groups" → Add
3. Click "+" under App Groups → enter: `group.com.salo.alahmuhammed`

**For the WidgetExtension target:**
1. Select WidgetExtension target → Signing & Capabilities tab
2. Click "+ Capability" → search "App Groups" → Add
3. Click "+" under App Groups → enter: `group.com.salo.alahmuhammed`

This will auto-generate `.entitlements` files for both targets.

### Step 4: Configure Signing
**For the App target:**
1. Signing & Capabilities → check "Automatically manage signing"
2. Team: select your Apple Developer team
3. Bundle Identifier: `com.salo.alahmuhammed`

**For the WidgetExtension target:**
1. Signing & Capabilities → check "Automatically manage signing"
2. Team: same team as App
3. Bundle Identifier: `com.salo.alahmuhammed.WidgetExtension`

### Step 5: App Icons
1. Prepare a 1024x1024 PNG master icon
2. In Xcode: select `Assets.xcassets` → `AppIcon`
3. Drag the 1024x1024 image into the App Store slot
4. Xcode will auto-generate all required sizes

Alternatively, use `android/app/src/main/res/` icons as reference — export at proper sizes.

### Step 6: Launch Screen
The current `LaunchScreen.storyboard` is the default Capacitor one. To customize:
1. Open `App/Base.lproj/LaunchScreen.storyboard`
2. Add a centered label or logo with the Arabic app name
3. Set background color to match app branding

### Step 7: Build & Verify
1. Select "Any iOS Device" as destination
2. Product → Archive
3. Wait for archive to complete
4. Organizer window opens → validate the archive
5. Distribute App → App Store Connect

### Step 8: App Store Connect
1. Log into https://appstoreconnect.apple.com
2. Create new app: name "صلِّ على محمد ﷺ", bundle ID `com.salo.alahmuhammed`
3. Fill in: description (Arabic), screenshots (6.5" + 5.5"), privacy policy URL
4. Upload build from Xcode Organizer
5. Submit for review

---

## Key Reminders
- WidgetExtension.swift phrase pool is independent from `src/salahPhrases.ts` — keep in sync manually
- Preference keys are stringly-typed — if adding settings, grep across .ts, .java, .swift
- App Group ID must match exactly in both entitlements AND the suiteName in WidgetExtension.swift
- The web layer does NOT write to the App Group — the widget only reads `user_lang` from UserDefaults(suiteName:)
