# 08 — Known Issues, Gotchas, and Behavioral Surprises

Issues found during this audit. Severity is my judgment based on user-visible impact.

## 🔴 Critical

### iOS widget cannot see the user's language setting
**Where:** `WidgetExtension.swift:374` reads `UserDefaults(suiteName: "group.com.salo.alahmoha")`. The Capacitor Preferences plugin writes to `NSUserDefaults.standard` because `capacitor.config.json` does **not** configure a plugin group:

```json
{
  "appId": "com.salo.alahmoha",
  "appName": "صلِّ على محمد ﷺ",
  "webDir": "dist"
}
```

**Effect:** the widget always defaults to Arabic. An English-speaking iOS user will permanently see Arabic text on their widget regardless of the app setting.

**Fix options:**
1. Add `Preferences` config to `capacitor.config.json`:
   ```json
   "plugins": { "Preferences": { "group": "group.com.salo.alahmoha" } }
   ```
   (Confirm against `@capacitor/preferences@7` docs — the iOS group key may be different in different plugin versions.)
2. Mirror the value into the App Group from `AppDelegate.applicationDidEnterBackground` and on language-change events.
3. Bridge from JS via a tiny custom Capacitor plugin that calls `UserDefaults(suiteName:)?.set(...)`.

---

## 🟠 High

### English iOS widget pool is only 6 phrases
**Where:** `WidgetExtension.swift:341–348` — `SalahPhrases.english` has 6 strings. The widget cycles through them every 6 hours.

**Effect:** English iOS users see the same phrase repeatedly. Arabic pool is ~333 strings, so Arabic users have a much richer experience.

**Fix:** populate the English array with translations of the Arabic pool, or accept the limitation and show 2–3 well-curated phrases on rotation.

---

### Phrase index is desynchronized between Android overlay and iOS widget
**Where:**
- Android: `salah_index` in SharedPrefs, incremented per overlay show, modulo array length.
- iOS: `Int(timeIntervalSince1970 / 3600) % pool.count`, computed from wall-clock time.

**Effect:** A user with Android *and* an iOS device sees different "next" phrases on each. Not a bug — just unintended divergence. Probably not worth fixing.

---

### ESLint config ignores TypeScript files
**Where:** `eslint.config.js:10` — `files: ['**/*.{js,jsx}']`. The actual codebase uses `.tsx` and `.ts`.

**Effect:** `npm run lint` doesn't lint anything meaningful. No type-aware rules, no unused-import detection on TS files.

**Fix:**
```js
files: ['**/*.{js,jsx,ts,tsx}'],
```
…and add `typescript-eslint` to the config. Strict mode is also off (`tsconfig.json:18`), so re-enabling that would catch a lot.

---

### No tests, no CI
**Effect:** Every change risks regressing the overlay rendering, the language sync, or the boot resilience paths — no safety net.

**Fix:** even minimal coverage helps:
- Vitest unit test for `getPhraseAtIndex` (already exported from `App.tsx:12`)
- Android instrumented test that verifies `OverlayHelper.calculateDuration` for each speed
- Snapshot test of the i18n resources object

---

## 🟡 Medium

### Phrase pools are duplicated and drifting
**Where:** `src/salahPhrases.ts` (~333 entries) and `WidgetExtension.swift::SalahPhrases.arabic` (~333 entries, manually copied).

**Effect:** When the team revises a phrase or adds new ones, only one side gets updated and the two pools drift. Currently there is no script enforcing parity.

**Fix:** generate `WidgetExtension.swift` (or a separate `Phrases.swift`) from `src/salahPhrases.ts` at build time. A 30-line Node script is enough.

---

### `salah_phrases` is rewritten on every app launch
**Where:** `App.tsx:62`.

**Effect:** ~60 KB JSON write to SharedPreferences on cold start, even when nothing changed. Negligible CPU but flushes the prefs file unnecessarily.

**Fix:** keep a `phrases_version` constant in JS; write only if the stored version differs.

---

### Two UI strings are not in i18n
**Where:** `App.tsx:182` ("Popup Speed" / "سرعة الإظهار") and `App.tsx:204` ("Hourly Reminder" / "تذكير كل ساعة"), and their description lines.

**Effect:** inconsistency. Adding a third language would require touching `App.tsx` instead of just `i18n.ts`.

**Fix:** move the four strings into `src/i18n.ts` resources and use `t(...)` like the rest.

---

### Hourly timer is not stopped immediately when the user disables it
**Where:** `SaloPrayerService.resetTimer()` only reads the pref next time it runs.

**Effect:** if a user disables the hourly reminder, they may still get one more reminder before the next reset (next unlock or screen-off cycle).

**Fix:** add a small intent / `LocalBroadcastManager` signal from the JS side after toggling, and have the service `stopTimer()` immediately. Or simply have the service register a `SharedPreferences.OnSharedPreferenceChangeListener`.

---

### Logcat dump checked into the repo
**Where:** `logcat.txt` (1.4 MB at root).

**Effect:** noise in the repo, possibly leaking device identifiers. Not your repo, but worth mentioning if you contribute upstream.

**Fix:** delete + add to `.gitignore`.

---

### `tsconfig.json` has `strict: false`
**Effect:** `any` is allowed silently, no `strictNullChecks`, no `noImplicitAny`. `App.tsx` casts `OverlayPlugin as any` to call `checkPermission` / `requestPermission`.

**Fix:** define a typed plugin contract:
```ts
import { registerPlugin } from "@capacitor/core";
interface OverlayPluginI {
  requestPermission(): Promise<{ granted: boolean }>;
  checkPermission(): Promise<{ granted: boolean }>;
  showPreview(): Promise<void>;
}
const OverlayPlugin = registerPlugin<OverlayPluginI>("OverlayPlugin");
```
Then enable `strict: true` and clean up.

---

## 🟢 Low / Cosmetic

### "Slow" speed is almost always capped at 15 s
`durationMs = min(15000, baseMs + textLength * charMultiplier)`. With `baseMs=5000`, `charMultiplier=130`, the 15s cap is hit at ~77 chars — and most Salawat phrases are 100+ chars. So "slow" feels indistinguishable from "max" most of the time.

**Fix:** either raise the cap or drop the `charMultiplier` — currently the granularity in this band is wasted.

---

### `OverlayPlugin.requestPermission` lies about state
The method returns `granted: false` immediately after launching the system settings, even though the user might grant permission in the next 5 seconds. The React app correctly compensates by re-checking on `visibilitychange`, but a naive caller would think the request failed.

**Fix:** rename to `openPermissionSettings` to make intent clear, or make the plugin observe `Settings.canDrawOverlays` after activity result. Capacitor plugins support `startActivityForResult` since v3 — could await the actual grant.

---

### Empty foreground service notification is OEM-dependent
Android's API contract says foreground service notifications must be visible. The empty title/text + `IMPORTANCE_MIN` channel works on stock Android (notification is hidden in a collapsed group), but some OEMs (Xiaomi, Samsung) will display a "Salah Reminder is running" toast that you can't suppress.

**Fix:** accept this and provide a better notification text/icon, since users will see it anyway. "Reminding you to send blessings" with the gold star icon would feel intentional.

---

### `Intent.ACTION_USER_UNLOCKED` is registered but never branched on
`SaloPrayerService.onCreate` adds it to the IntentFilter but the receiver only checks `ACTION_USER_PRESENT` and `ACTION_SCREEN_OFF`. Dead code — no harm, but worth removing for clarity.

---

### `OverlayHelper.removeOverlay` may briefly leak the listener
The `OnTouchListener` is set on `overlayView`, but `overlayView = null` is assigned **before** `windowManager.removeView()`. If `removeView` throws (it can in race conditions), the View is orphaned with the listener still attached. Not a functional bug — the View has no strong refs to the service — but cleanly setting the listener to `null` first would be safer.

---

### `ServiceRestarterWorker.getForegroundInfo()` re-creates the channel
Every time WorkManager runs the worker as expedited, it re-creates the `unlock_channel`. Idempotent (`createNotificationChannel` is a no-op if the channel exists), but wasteful.

---

## Behavioral surprises (not bugs, just non-obvious)

1. **Toggling the hourly reminder OFF does not cancel an in-flight timer** — see medium issue above.
2. **The overlay reappears 10 seconds after being dismissed** if the user unlocks again, because the cooldown is from "last shown" not "last dismissed".
3. **Setting language in app does not change the overlay text on next show** because the overlay reads `salah_phrases` directly, which always contains Arabic strings (the JS sync stores Arabic regardless of `user_lang`). The default fallback string *is* localized, but the cycling phrases are Arabic-only.
4. **The settings UI's "Popup Speed" affects both unlock-triggered and hourly overlays** — same display duration logic.
5. **`MainActivity.onResume` overrides the webview's language with the SharedPrefs value** every time the user backgrounds and foregrounds the app. If you debug with a JS console open and manually change `localStorage.user_lang`, your change will be reverted next foreground.
6. **The widget's hourly rotation is wall-clock-aligned**, not relative to "when the user added the widget". So the user may add the widget at 14:30 and see the same phrase until 15:00.
