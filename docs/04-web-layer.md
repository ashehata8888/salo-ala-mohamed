# 04 — Web Layer (React + Vite + Capacitor webview)

## Stack

- **React 19** — `react`/`react-dom@^19.2.4`
- **TypeScript 6** — bundler-mode resolution, `strict: false`, no emit
- **Vite 8** — vanilla setup, `@vitejs/plugin-react`
- **i18next + react-i18next** — Arabic + English; resources defined inline in `src/i18n.ts`
- **SCSS** (sass package) — single `main.scss`, ~880 lines, dark/gold "premium" theme
- **`@capacitor/preferences`** — only Capacitor plugin imported on the JS side besides `core`
- **No state library, no router, no test runner** — the surface is one screen

## Files

| File | Role |
|------|------|
| `index.html` | Sets `<html dir>` from `localStorage.user_lang` synchronously **before React mounts**, so RTL Arabic doesn't flash LTR. Preloads four `.woff2` fonts. |
| `src/main.tsx` | Awaits `initI18n()`, then renders `<App />` inside `<StrictMode>`. |
| `src/i18n.ts` | Initializes i18next synchronously from `localStorage`, then reconciles with Capacitor Preferences asynchronously. |
| `src/App.tsx` | Single-screen settings UI. Manages permission + 3 settings. |
| `src/main.scss` | Theme. Lots of commented-out scaffolding from the Vite template; live styles start ~line 212. |
| `src/salahPhrases.ts` | Just `export const salahPhrases: string[] = [ ... 333 strings ... ]`. |
| `public/fonts/*` | `Amiri-Regular`, `Amiri-Bold`, `AmiriQuran-Regular`, `Cinzel-Regular` (woff2). |

## App.tsx walkthrough

```
useState
  hasPermission: boolean | null   // null = checking
  isTimerEnabled: boolean = true
  popupSpeed: string = "medium"

Mount effect 1 (permission)
  ─ Read cached overlay_permission_granted → seed UI immediately
  ─ Call native checkPermission() → update state + cache
  ─ 3-second safety timer: null → false (in case native call hangs)

Mount effect 2 (other prefs)
  ─ Read enable_active_timer; write "true" if missing
  ─ Read popup_speed; write "medium" if missing
  ─ Write salahPhrases JSON to CapacitorStorage.salah_phrases  ← every launch

Mount effect 3 (RTL)
  ─ Set document.documentElement.dir = "rtl" if i18n.language === "ar"

Mount effect 4 (visibilitychange)
  ─ When app returns to foreground (e.g., from system Settings),
    re-run checkPermission() so UI updates if user just granted it
```

### Permission flow

```
        ┌───────────────────────┐
        │ User taps "Grant      │
        │ Permission" button    │
        └──────────┬────────────┘
                   ▼
        ┌───────────────────────┐
        │ App.tsx:requestPerm   │
        │ → OverlayPlugin       │
        │ .requestPermission()  │
        └──────────┬────────────┘
                   ▼
        ┌───────────────────────────────────┐
        │ Java side: OverlayPlugin          │
        │  if !canDrawOverlays:             │
        │    Intent ACTION_MANAGE_OVERLAY_  │
        │    PERMISSION                     │
        │    startActivity(NEW_TASK)        │
        │    resolve({ granted: false })    │
        │  else:                            │
        │    resolve({ granted: true })     │
        └──────────┬────────────────────────┘
                   ▼
        ┌──────────────────────────┐
        │ User toggles in Android  │
        │ Settings → returns       │
        └──────────┬───────────────┘
                   ▼
        ┌─────────────────────────────────┐
        │ visibilitychange listener       │
        │ → checkPermission() re-runs     │
        │ → state flips to granted=true   │
        │ → permission section unmounts   │
        └─────────────────────────────────┘
```

This is a clean pattern — no manual "I just came back, please re-check" button is needed.

## Language flow

```
JS side:
  Mount     → localStorage.user_lang ?? "ar" → i18n init
  Toggle Ar → localStorage.user_lang = "ar"
              i18n.changeLanguage("ar")
              Preferences.set({ key: "user_lang", value: "ar" })

Native side (Android, on resume):
  MainActivity.injectLangIntoWebView reads SharedPrefs.user_lang
  Sanitizes to "ar" | "en"
  Evaluates: localStorage.setItem(...); document.documentElement.setAttribute(...)
```

This means: if you somehow set `user_lang` in SharedPreferences from outside the app (e.g., via `adb shell run-as`), the next foregrounding will reflect it. In practice, the JS side is always the writer.

## i18n resources

All strings live inline in `src/i18n.ts`. There's no extraction step — to add a key, edit the file. Keys present today:

```
app_title, settings, language, arabic, english, salah_reminder,
draw_over_apps, draw_over_apps_desc, grant_permission, permission_granted,
salah_desc, preview, check_permission, permission
```

Two of the labels in `App.tsx` (Popup Speed, Hourly Reminder) are **NOT** in the i18n resources — they're inlined with a `isRtl ? "..." : "..."` ternary (`App.tsx:182` and `App.tsx:204`). Probably accidental — these should be moved into i18n for consistency.

## Styling notes

- The `glass-container`, `app-header`, `settings-section`, `action-row`, etc. classes drive a custom dark theme with gold accents. There's a CSS `@property --angle` + `@keyframes rotate-shimmer` shimmer effect.
- `.rtl` and `.ltr` modifier classes on the root container handle direction-aware styling (icons flip, padding mirrors).
- The active CSS lives between lines ~212 and ~880; everything before line 212 is commented-out template scaffolding from `npm create vite@latest`.

## Browser-mode behavior (`npm run dev`)

The app runs in Chrome/Safari fine, but:
- `Capacitor.isNativePlatform()` returns `false` → permission flow is gated, "This feature is only available on Android native app." alert fires when the user clicks Grant.
- `Preferences` falls back to `localStorage`, so settings *do* persist across browser refreshes.
- The settings UI is fully interactive — useful for theme/RTL/i18n iteration without a device.
