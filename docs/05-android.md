# 05 — Android Native Layer

The Android side is where the actual feature lives. The webview is a thin shell; the unlock-overlay is built by hand-rolled Java that fights the OS to stay alive.

## Components & responsibilities

| File | Type | Responsibility |
|------|------|----------------|
| `MainActivity.java` | `BridgeActivity` | Bootstraps Capacitor, registers `OverlayPlugin`, **starts the foreground service**, schedules the periodic restarter worker, injects language back into the webview on resume |
| `OverlayPlugin.java` | `@CapacitorPlugin` | Exposes `requestPermission`, `checkPermission`, `showPreview` to JS |
| `SaloPrayerService.java` | foreground `Service` | Listens for screen-unlock broadcasts, runs the hourly timer, calls `OverlayHelper.showOverlay` |
| `OverlayHelper.java` | static helpers | Builds the overlay view via `WindowManager`, picks a phrase, manages dismiss timer + touch-to-dismiss + swipe-to-dismiss |
| `AnimatedGlowBorderView.java` | custom `View` | Animated white border that erases clockwise — visual countdown bar |
| `BootReceiver.java` | `BroadcastReceiver` | Restarts the service after boot (regular + locked-boot), user unlock, custom action |
| `ServiceRestarterWorker.java` | `Worker` | WorkManager backup path: keeps the service running if the OS killed it |

## Manifest highlights

```xml
<service
    android:name=".SaloPrayerService"
    android:foregroundServiceType="specialUse"
    android:directBootAware="true"
    android:exported="false">
    <property android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
              android:value="unlock_listener" />
</service>

<receiver android:name=".BootReceiver" android:exported="true" android:directBootAware="true">
    <intent-filter android:priority="999">
        <action android:name="android.intent.action.LOCKED_BOOT_COMPLETED" />
        <action android:name="android.intent.action.BOOT_COMPLETED" />
        <action android:name="android.intent.action.USER_UNLOCKED" />
        <action android:name="android.intent.action.QUICKBOOT_POWERON" />  <!-- Samsung quick-boot -->
        <action android:name="com.salo.alahmoha.RESTART_SERVICE" />        <!-- self-trigger -->
    </intent-filter>
</receiver>

<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

`FOREGROUND_SERVICE_TYPE_SPECIAL_USE` is required by Android 14 (API 34) for foreground services that don't fit a built-in category. The `unlock_listener` subtype is a free-form string declared via `<property>` per Google's policy. Play Store policy may require justification text for this when publishing.

## Foreground service

`SaloPrayerService` is the heart of the system.

### Startup

```
onCreate
  ├─ Create "unlock_channel" NotificationChannel (importance MIN, no sound, no badge)
  ├─ Build empty notification (title="" text="" small icon=ic_dialog_info)
  ├─ startForeground(1, notification, FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
  │       (the special-use type arg only on Android 14+ / UPSIDE_DOWN_CAKE)
  ├─ Register screenReceiver for:
  │     ACTION_USER_PRESENT   ← unlock
  │     ACTION_SCREEN_OFF     ← screen off
  │     ACTION_USER_UNLOCKED  ← (registered but never branched on; no-op)
  └─ resetTimer()  (skipped if Direct Boot — SharedPrefs not yet available)
```

The notification is intentionally empty/minimal — Android requires a foreground service to show *some* notification, but this one tries hard to be invisible. Some launchers/OEMs will still show a "Salah Reminder is running" toast.

### Hourly timer

```
timerRunnable: showOverlay(this); postDelayed(this, ONE_HOUR_MS)

resetTimer():
  removeCallbacks(timerRunnable)
  if SharedPrefs("enable_active_timer") == "true":
      postDelayed(timerRunnable, 1h)

stopTimer():
  removeCallbacks(timerRunnable)   // does NOT cancel the runnable's
                                   // re-posting — but since each fire
                                   // re-posts via the SAME handler,
                                   // a removeCallbacks cancels future fires.
```

| Event | Effect on timer |
|-------|-----------------|
| Service start | `resetTimer()` → schedules in 1h (if enabled) |
| Screen off (`ACTION_SCREEN_OFF`) | `stopTimer()` → cancels |
| Screen unlock (`ACTION_USER_PRESENT`) | `resetTimer()` from `showOverlayWithCooldown` → 1h fresh |
| Toggle setting OFF in app | **Does not stop a running timer mid-flight.** Will only take effect on next reset (next unlock or screen-off cycle). |

This means: if the timer is armed and the user turns it off, they can still see one more hourly reminder until the next screen-off + unlock cycle. Worth knowing when debugging "why did I get a popup after I turned this off?".

### Unlock trigger + cooldown

```java
COOLDOWN_MS = 10000  // 10 seconds

showOverlayWithCooldown(ctx):
    if now - lastShownTime > 10s:
        lastShownTime = now
        OverlayHelper.showOverlay(ctx)
        resetTimer()
```

The cooldown exists because `ACTION_USER_PRESENT` can fire multiple times rapidly during certain unlock flows (face unlock + retry, fingerprint failure + PIN). 10 seconds is generous.

A `Handler.removeCallbacksAndMessages(null)` debounce on the unlockHandler also runs before each show call.

## Overlay rendering

`OverlayHelper.showOverlay(Context)` runs on the main looper.

### Re-show vs first-show

The function has two branches:

1. **First show** (`overlayView == null`): builds a new RelativeLayout with the gold gradient card + AnimatedGlowBorderView, attaches via `WindowManager.addView(...)`, schedules dismiss.
2. **Re-show** (`overlayView != null`): the previous overlay is still on screen. Just resets the dismiss timer, restarts the border animation, **reads the same phrase that's already shown** (by reading `salah_index - 1` because the index was already incremented).

Both branches read `popup_speed`, `user_lang`, `salah_phrases`, `salah_index` from `CapacitorStorage` SharedPrefs.

### Visual structure

```
RelativeLayout (rootFrame)
├── LinearLayout (the gold card)
│   └── TextView (the phrase, 24sp bold black on gold gradient)
└── AnimatedGlowBorderView (the moving white highlight on top of the gold border)
```

Background: `GradientDrawable` with `TL_BR` orientation, `#a8813a → #ebd089 → #a8813a` (45° gold/bronze sweep). Static dark-gold stroke 7px wide, dark color `#7a5c1e`. Corner radius 50dp.

### Animated border

`AnimatedGlowBorderView`:
- Uses `LAYER_TYPE_SOFTWARE` because the path-segment-stroke trick is broken on hardware-accelerated layers on some GPUs.
- Builds a `Path` along the rounded rectangle, then on every animation tick draws only the segment from `pathLength * animatedValue` to `pathLength`.
- As `animatedValue` ticks 0 → 1 over `durationMs`, the border "erases" clockwise — a visual countdown matching the dismiss timer.
- Linear interpolator (no ease) for steady-clock feel.

### Dismiss behavior

| Gesture | Result |
|---------|--------|
| Tap | Dismiss immediately (`isMoved == false` branch in `ACTION_UP`) |
| Drag <50px | Ignored (just resets) |
| Drag 50–150px | Snap back with 200ms tween |
| Drag >150px | Dismiss |
| Auto | Dismiss after `calculateDuration()` ms |

Drag also fades the overlay (`alpha = 1 - |delta|/500`) so it feels "thrown away."

`removeOverlay()` cancels the dismiss runnable and calls `windowManager.removeView()`. `overlayView = null` is set **before** the remove call, so re-entry from a quick second tap is safe.

## Boot resilience (5 paths)

Android aggressively kills user-installed services. The app has **5 separate paths** to ensure `SaloPrayerService` is alive when the user unlocks:

| Path | Trigger | File |
|------|---------|------|
| 1 | App opened (cold start) | `MainActivity.onCreate` calls `startForegroundService` |
| 2 | Device boot | `BootReceiver` listens to `BOOT_COMPLETED`, `LOCKED_BOOT_COMPLETED`, `USER_UNLOCKED`, `QUICKBOOT_POWERON` — calls `startForegroundService` directly |
| 3 | Boot (backup) | Same `BootReceiver` *also* schedules `OneTimeWorkRequest` with `setExpedited(...)` |
| 4 | Periodic | `MainActivity.onCreate` enqueues `PeriodicWorkRequest` for `ServiceRestarterWorker` every 15 minutes via `WorkManager`, with `KEEP` policy |
| 5 | Self-revive after task swipe | `SaloPrayerService.onTaskRemoved` schedules an `AlarmManager` alarm 1s ahead, targeting `BootReceiver` with the custom `RESTART_SERVICE` action |

This is **defense in depth, not paranoia** — OEMs (Xiaomi, Huawei, Vivo, OPPO, Samsung battery optimizer) each kill background work in different ways. The redundancy maximizes survival odds.

The custom action `com.salo.alahmoha.RESTART_SERVICE` is whitelisted in the manifest's intent-filter so the receiver picks it up.

## Direct boot

`SaloPrayerService` and `BootReceiver` are both `android:directBootAware="true"`. This means they can run **before** the user has unlocked the device after reboot (during the encrypted "Direct Boot" period). At that time, `getSharedPreferences()` is **not** available — only Device Protected Storage is.

`SaloPrayerService.onCreate` wraps `resetTimer()` in a try/catch for exactly this reason — if reading prefs fails during direct boot, the timer simply isn't started; the first `ACTION_USER_PRESENT` on unlock will trigger `showOverlayWithCooldown → resetTimer` to start it normally.

## What runs in MainActivity

```java
onCreate:
  1. registerPlugin(OverlayPlugin.class)   // before super.onCreate
  2. startForegroundService(SaloPrayerService)  // service alive during webview
  3. WorkManager periodic 15-min restarter (KEEP policy)

onResume:
  injectLangIntoWebView()
    - Reads SharedPrefs("CapacitorStorage").user_lang (default "ar")
    - Sanitizes to ar/en
    - WebView.evaluateJavascript():
        localStorage.setItem('user_lang', '<lang>');
        document.documentElement.setAttribute('dir', '<rtl|ltr>');
        document.documentElement.setAttribute('lang', '<lang>');
```

This means: external language changes (impossibly, but theoretically) get reflected in the webview on next resume. In practice, the only writer is the React app itself.

## OverlayPlugin (Capacitor bridge)

| Method | Behavior |
|--------|----------|
| `checkPermission` | Returns `{ granted: Settings.canDrawOverlays(...) }` |
| `requestPermission` | If not granted, opens `ACTION_MANAGE_OVERLAY_PERMISSION` system settings, **resolves immediately with `granted: false`**. The user then either grants or doesn't, and the webview re-checks on `visibilitychange`. |
| `showPreview` | Manually triggers `OverlayHelper.showOverlay()`. **Currently unused by the React UI** — could be wired to a "preview" button. |

## Versioning & dependencies

- `compileSdk` / `targetSdk` = **35** (Android 15) — see `android/variables.gradle`
- `minSdk` = **24** (Android 7.0)
- AGP `8.2.1`, Google services `4.4.4`
- AndroidX core `1.12.0`, splash screen `1.0.1`, work-runtime `2.9.0`
- Capacitor 7 (managed via `node_modules` + `android/capacitor.settings.gradle`)

`compileSdk = 35` while `targetSdk = 35` is the recommended path for Android 15.

## Things to know if you're modifying Java

- Style: 4-space indent, no @Override on package-private interfaces, raw `e.printStackTrace()` is acceptable in this codebase (not "production-grade" but pragmatic).
- No Kotlin — keep additions in Java to match existing style.
- No DI, no Hilt — direct construction is fine for code this small.
- All overlay code runs on the main thread via `Handler(Looper.getMainLooper())`. Don't add long work there.
- `WindowManager.addView` can throw on certain devices if permission was just revoked between check and add — every call is wrapped in try/catch.
