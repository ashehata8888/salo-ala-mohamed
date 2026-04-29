# 02 — Architecture

## Top-level layout

```
salo-ala-mohamed/
├── src/                       ← React + TypeScript settings UI
│   ├── App.tsx                  Single-screen settings + permission flow
│   ├── main.tsx                 Bootstrap: init i18n, mount React
│   ├── i18n.ts                  i18next setup (ar/en, syncs with Preferences)
│   ├── salahPhrases.ts          ~333 Arabic phrases (the app's content payload)
│   └── main.scss                Global styles (dark/gold theme, glassmorphism)
├── public/fonts/              ← Amiri / AmiriQuran / Cinzel woff2 (preloaded)
├── index.html                 ← Sets <html dir> from localStorage before React mounts
├── vite.config.ts             ← Vanilla Vite + plugin-react config
├── capacitor.config.json      ← appId, webDir
│
├── android/
│   └── app/src/main/
│       ├── AndroidManifest.xml         ← Permissions, service, receiver, FileProvider
│       └── java/com/salo/alahmoha/
│           ├── MainActivity.java        ← BridgeActivity; starts service + scheduler
│           ├── OverlayPlugin.java       ← Capacitor plugin: requestPermission/checkPermission/showPreview
│           ├── OverlayHelper.java       ← Builds & shows the floating overlay view (WindowManager)
│           ├── AnimatedGlowBorderView.java  ← Custom View: animated gold border (countdown bar)
│           ├── SaloPrayerService.java   ← Foreground service; listens for ACTION_USER_PRESENT, hourly timer
│           ├── BootReceiver.java        ← Restarts service on boot/unlock + custom action
│           └── ServiceRestarterWorker.java  ← WorkManager backup path
│
└── ios/
    └── App/
        ├── App/                              ← Capacitor host app (settings UI in webview)
        │   ├── AppDelegate.swift             ← Default Capacitor delegate (no customization)
        │   └── Info.plist
        ├── App.xcodeproj
        ├── CapApp-SPM/                       ← Capacitor Swift Package Manager scaffolding
        └── WidgetExtension/                  ← Manually added Xcode target (NOT created by `cap sync`)
            └── WidgetExtension.swift         ← TimelineProvider + SwiftUI view + 333 embedded phrases
```

## Component diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│  USER INTERACTION                                                        │
│  Opens app                  Unlocks phone              Looks at home     │
│       │                          │                       screen (iOS)    │
└───────┼──────────────────────────┼───────────────────────────┼───────────┘
        ▼                          ▼                           ▼
┌────────────────┐          ┌──────────────────┐       ┌──────────────────┐
│  Capacitor     │          │  SaloPrayerSvc   │       │  ProphetSalah    │
│  WebView       │          │  (foreground)    │       │  Widget          │
│  React app     │          │                  │       │  (WidgetKit)     │
│                │          │  BroadcastRecv:  │       │                  │
│  - settings    │          │  ACTION_USER_    │       │  TimelineProvider│
│  - permission  │          │  PRESENT,        │       │  emits 24 entries│
│    request     │          │  SCREEN_OFF      │       │  Reads user_lang │
│                │          │                  │       │  from App Group  │
│  Writes →      │          │  Triggers:       │       │                  │
│  CapacitorStg  │          │  • on unlock     │       │  Renders phrase  │
│  Preferences   │          │    (10s cooldown)│       │  every hour      │
│                │          │  • hourly timer  │       │                  │
└──────┬─────────┘          │    (3,600,000ms) │       └──────────────────┘
       │                    │                  │              ▲
       │ writes             │  Calls           │              │
       │                    │  OverlayHelper   │              │ reads
       ▼                    │  .showOverlay()  │              │
┌────────────────┐          │                  │       ┌──────┴───────────┐
│ SharedPrefs    │ ◀────────┤ reads prefs:     │       │ App Group        │
│ "CapacitorStg" │          │  popup_speed     │       │ NSUserDefaults   │
│  user_lang     │          │  enable_active_  │       │ "group.com.salo. │
│  popup_speed   │          │   timer          │       │  alahmoha"       │
│  enable_active_│          │  user_lang       │       │                  │
│   timer        │          │  salah_phrases   │       │ ⚠ Web layer does │
│  salah_phrases │          │  salah_index     │       │   NOT write here │
│  salah_index   │          │                  │       │                  │
│  overlay_perm  │          │  Increments      │       │   ↪ widget always│
│   _granted     │          │  salah_index     │       │     defaults to  │
└────────────────┘          └────────┬─────────┘       │     Arabic       │
       ▲                             │                 └──────────────────┘
       │ on resume:                  ▼
       │ injectLangIntoWebView  ┌──────────────────┐
       │ (one-way, native→web)  │  WindowManager   │
       │                        │  TYPE_APPLICATION│
┌──────┴─────────┐              │  _OVERLAY        │
│ MainActivity   │              │                  │
│ (BridgeActivity)│             │  Adds overlay    │
└────────────────┘              │  view + animated │
                                │  countdown       │
                                │  border          │
                                └──────────────────┘
```

## Why this shape?

1. **iOS sandbox forbids drawing over other apps and listening for unlocks**, so iOS gets a passive widget instead. Code paths are intentionally unshared between the two — no abstraction would simplify them.
2. **The webview is just settings**. All logic that *delivers value* runs in native code (Java service for Android, Swift `TimelineProvider` for iOS). React is the cheapest way to ship a polished settings screen with i18n + RTL.
3. **`@capacitor/preferences` is the IPC layer**, abused as a shared blackboard between JS and Java. The native side reads `getSharedPreferences("CapacitorStorage", ...)` directly — no plugin round-trip required for hot-path reads inside the service.

## Boundaries / contracts

| From → To | Mechanism | Contract |
|-----------|-----------|----------|
| JS → Java | Capacitor plugin call (`OverlayPlugin.requestPermission` etc.) | JSObject in/out |
| JS ↔ Java | `CapacitorStorage` SharedPreferences (string keys) | See [03-data-flow.md](./03-data-flow.md) |
| Java → JS | `WebView.evaluateJavascript()` from `MainActivity.injectLangIntoWebView` | One-shot script on resume |
| JS → iOS Widget | **Currently broken — see [08-known-issues.md](./08-known-issues.md)** | Should go via App Group `UserDefaults`; doesn't |
| Service → System | `WindowManager.addView()` with `TYPE_APPLICATION_OVERLAY` | Requires `SYSTEM_ALERT_WINDOW` |
| Boot → Service | BroadcastReceiver (`BootReceiver`) + WorkManager (expedited + periodic) | Defense in depth |

## Key invariants

- The Capacitor webview is the **only** owner of the React app — it runs identically in browser dev (`npm run dev`) but with `OverlayPlugin` calls degraded to no-ops.
- The Android foreground service must always be running for the unlock-trigger to work. Five separate restart paths exist (see [05-android.md](./05-android.md#boot-resilience)).
- The iOS widget is **fully self-contained** — it has its own copy of phrases and reads only `user_lang` from external state.
