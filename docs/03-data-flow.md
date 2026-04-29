# 03 — Data Flow & Preference Keys

The whole app is glued together by ~7 string keys in `CapacitorStorage` SharedPreferences (Android) / `NSUserDefaults.standard` (iOS). This document is the **single source of truth for what each key means and who touches it**.

## How `@capacitor/preferences` actually works

| Platform | Backing store | Key namespace |
|----------|---------------|---------------|
| Android | `getSharedPreferences("CapacitorStorage", MODE_PRIVATE)` | The exact string `"CapacitorStorage"` |
| iOS | `NSUserDefaults.standard` | Plugin prefixes keys with `"CapacitorStorage."` by default (verify against plugin version 7.x) |
| Browser | `localStorage` | Plain string keys |

**All values are stored as strings.** Booleans are `"true"` / `"false"`. Integers from JS are stored as strings; Java code reads them as `prefs.getInt(...)` only for `salah_index` (because Java code is also the only writer for that one).

## Preference keys

### `user_lang`
**Type:** `"ar"` \| `"en"` (string)
**Default:** `"ar"`

| Layer | Read | Write |
|-------|------|-------|
| `index.html` (head) | ✅ from `localStorage` (sync, before React mounts) | — |
| `i18n.ts` | ✅ from `localStorage` (sync init) | — |
| `App.tsx::changeLanguage` | — | ✅ writes both `localStorage` + `Capacitor Preferences` |
| `i18n.ts::syncLangToPreferences` | ✅ from Preferences (called from `main.tsx`) | reconciles into `localStorage` |
| `MainActivity::injectLangIntoWebView` | ✅ from SharedPrefs on resume | injects into `localStorage` + `<html dir>` via JS eval |
| `OverlayHelper::showOverlay` | ✅ for the default fallback text | — |
| `WidgetExtension.swift::getTimeline` | ✅ from `UserDefaults(suiteName: "group.com.salo.alahmoha")` | — |

**⚠ Bug:** the iOS widget reads from the **App Group**, but the Capacitor Preferences plugin writes to `NSUserDefaults.standard` (no `groupName` configured in `capacitor.config.json`). Result: **the widget never sees a language change made in the app** — it always defaults to Arabic. Fix: configure the plugin's iOS group, or write a tiny native bridge that mirrors `user_lang` into the App Group on every change. See [08-known-issues.md](./08-known-issues.md).

---

### `popup_speed`
**Type:** `"slow"` \| `"medium"` \| `"fast"`
**Default:** `"medium"`

| Layer | Read | Write |
|-------|------|-------|
| `App.tsx` mount | ✅ initial load + writes `"medium"` if missing | ✅ on dropdown change |
| `OverlayHelper::calculateDuration` | ✅ on every overlay show | — |

Affects how long the overlay stays on screen:

```
durationMs = min(15000, baseMs + textLength * charMultiplier)
```

| Speed | baseMs | charMultiplier | Effective duration for ~80-char phrase |
|-------|--------|----------------|----------------------------------------|
| fast | 1500 | 50 | 5,500 ms |
| medium | 3000 | 90 | 10,200 ms |
| slow | 5000 | 130 | **15,000 ms (capped)** |

Note: most Salawat phrases are >100 characters, so "slow" is almost always capped at 15s. Effective ceiling is hardcoded at 15s.

---

### `enable_active_timer`
**Type:** `"true"` \| `"false"`
**Default:** `"true"` (written explicitly on first launch in `App.tsx`)

| Layer | Read | Write |
|-------|------|-------|
| `App.tsx` mount | ✅ + writes `"true"` if missing | ✅ on toggle |
| `SaloPrayerService::resetTimer` | ✅ each time the timer is (re)scheduled | — |

When `false`, the hourly timer is never armed; only the unlock trigger fires. The unlock trigger is **independent** of this flag — toggling it off does not stop unlock-triggered overlays.

---

### `salah_phrases`
**Type:** JSON-stringified `string[]` of ~333 items
**Default:** `null`

| Layer | Read | Write |
|-------|------|-------|
| `App.tsx` mount | — | ✅ syncs `salahPhrases` import on **every app start** |
| `OverlayHelper::showOverlay` | ✅ parses JSON; falls back to a single hardcoded default if missing/empty | — |

**Behavioral note:** the JS layer is the **only** source of truth for the Android phrase pool. If the app has never been opened on a fresh install, the overlay shows the fallback `"اللهم صل وسلم على نبينا محمد ﷺ"` (or English equivalent if `user_lang=en`).

**Inefficiency note:** the entire ~60KB JSON array is rewritten to SharedPreferences on every app launch even when it hasn't changed. Not catastrophic, but unnecessary I/O. A version key + diff check would fix it.

---

### `salah_index`
**Type:** `Integer` (stored via `prefs.getInt` / `putInt`)
**Default:** `0`

| Layer | Read | Write |
|-------|------|-------|
| `OverlayHelper::showOverlay` (creation path) | ✅ uses as cursor; increments by 1 (mod array length) | ✅ |
| `OverlayHelper::showOverlay` (re-show path) | ✅ **reads index minus 1** to display the same phrase that was already shown | — |

This is the only key written exclusively by Java — JS never touches it. **Be careful**: the increment-then-decrement-on-reuse pattern in `OverlayHelper.java:73` is fragile. If the order of operations is changed, an off-by-one will appear immediately.

The iOS widget **does not use this key** — it computes its own index from wall-clock time (`Int(timeIntervalSince1970 / 3600) % pool.count`). The two surfaces show **different "current" phrases**, by design.

---

### `overlay_permission_granted`
**Type:** `"true"` \| `"false"`
**Default:** absent (treated as not yet checked)

| Layer | Read | Write |
|-------|------|-------|
| `App.tsx` mount | ✅ used as optimistic cache so UI doesn't flash | ✅ updated after every native check |

This is purely a UX caching key — the source of truth is `Settings.canDrawOverlays(...)` from `OverlayPlugin.checkPermission`. The cache prevents a "permission lost" flash on every launch.

A safety timer in `App.tsx:38` flips a stuck `null` to `false` after 3 seconds in case the native call hangs.

---

## Where each piece of state lives, summarized

```
                          ┌──────────────────────────────┐
                          │ CapacitorStorage SharedPrefs │  ← Android
                          │ (also NSUserDefaults on iOS) │
                          ├──────────────────────────────┤
                          │ user_lang                    │
                          │ popup_speed                  │
                          │ enable_active_timer          │
                          │ salah_phrases    (JS only)   │
                          │ salah_index      (Java only) │
                          │ overlay_permission_granted   │
                          └──────────────────────────────┘
                                       ▲
                                       │ read/write
       ┌───────────────────────────────┼─────────────────────────────────┐
       │                               │                                 │
┌──────┴──────┐                ┌───────┴────────┐               ┌────────┴───────┐
│  React UI   │                │  Java service  │               │   iOS Widget   │
│  (settings) │                │   + overlay    │               │   (WidgetKit)  │
└─────────────┘                └────────────────┘               └────────┬───────┘
                                                                         │
                                                                         │ reads ONLY
                                                                         ▼
                                                            ┌────────────────────────┐
                                                            │ App Group UserDefaults │
                                                            │ "group.com.salo.       │
                                                            │  alahmoha"             │
                                                            │  user_lang             │
                                                            │                        │
                                                            │ ⚠ Nothing currently    │
                                                            │   writes here.         │
                                                            └────────────────────────┘
```

## Lifecycle / timing

```
App launch (web)
  index.html <head> reads localStorage.user_lang   (synchronous, no flash)
        ↓
  initI18n() → sets i18n language synchronously
        ↓
  ReactDOM.createRoot().render(<App />)
        ↓
  App mount effect:
    1. Read overlay_permission_granted (cache)
    2. checkPermission()  → updates state + cache
    3. Read enable_active_timer / popup_speed; write defaults if missing
    4. Sync salahPhrases → CapacitorStorage.salah_phrases  (every launch!)
        ↓
  visibilitychange → checkPermission() again on every return
```

```
Android process start (cold)
  MainActivity.onCreate
    1. registerPlugin(OverlayPlugin)
    2. startForegroundService(SaloPrayerService)
    3. WorkManager.enqueueUniquePeriodicWork(15-min ServiceRestarterWorker)
        ↓
  SaloPrayerService.onCreate
    1. Create low-importance notification channel
    2. startForeground(1, notification, FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
    3. Register screenReceiver for ACTION_USER_PRESENT, SCREEN_OFF, USER_UNLOCKED
    4. resetTimer() — schedules timerRunnable in 1h IF enable_active_timer=true
        ↓
  Service idles. On unlock (ACTION_USER_PRESENT):
    showOverlayWithCooldown() if >10s since last shown
    resetTimer() — restart hourly clock from now
        ↓
  Hourly timer fires → showOverlay → re-posts itself in another 1h
        ↓
  On screen off → stopTimer (timer pauses; resumes on next unlock)
```

```
iOS widget refresh
  System asks getTimeline(in:context:)
    1. Read user_lang from group.com.salo.alahmoha (always "ar" today — see bug)
    2. Generate 24 entries, one per hour
    3. Index = (hours-since-epoch) mod pool.count
    4. Return Timeline(entries, policy: .atEnd)
  System renders next entry as time advances
```
