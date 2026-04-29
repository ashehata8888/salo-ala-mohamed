# 09 — Improvement Ideas

A grab-bag of ideas, ordered by *impact-to-effort ratio*. Each one is something I'd consider proposing to the original author. Pick the ones that align with where you'd want to take this.

## Quick wins (low effort, real value)

### 1. Fix the iOS widget language gap
~30 LOC to add `Preferences.group` to `capacitor.config.json` (or write a 20-line bridge plugin). Today **most iOS users effectively can't change language for the widget**. See [08-known-issues.md § Critical](./08-known-issues.md).

### 2. Lint and type-check TypeScript files
Update `eslint.config.js` to include `.ts/.tsx`, add `typescript-eslint`, flip `tsconfig.json` to `strict: true`. Will surface ~5–10 latent issues.

### 3. Type the `OverlayPlugin` properly
```ts
interface OverlayPluginI {
  requestPermission(): Promise<{ granted: boolean }>;
  checkPermission(): Promise<{ granted: boolean }>;
  showPreview(): Promise<void>;
}
```
Removes `as any` casts in `App.tsx`. Self-documenting.

### 4. Move inline strings into i18n
"Popup Speed" / "سرعة الإظهار" and "Hourly Reminder" / "تذكير كل ساعة" in `App.tsx` belong in `i18n.ts`. Trivial change.

### 5. Don't rewrite `salah_phrases` on every launch
Add a version constant; only sync if version changed.
```ts
const PHRASES_VERSION = "v1";
const stored = await Preferences.get({ key: "salah_phrases_version" });
if (stored.value !== PHRASES_VERSION) {
  await Preferences.set({ key: "salah_phrases", value: JSON.stringify(salahPhrases) });
  await Preferences.set({ key: "salah_phrases_version", value: PHRASES_VERSION });
}
```

### 6. Stop the hourly timer immediately when toggled off
Either:
- Have the JS layer call a Capacitor plugin method that broadcasts a stopTimer intent, or
- Register a `SharedPreferences.OnSharedPreferenceChangeListener` in `SaloPrayerService.onCreate` and react to changes.

### 7. Generate Swift phrase array from `src/salahPhrases.ts`
A 30-line Node script run as part of `cap sync`:
```js
// scripts/generate-ios-phrases.js
const phrases = require("../src/salahPhrases").salahPhrases;
const swift = `// AUTO-GENERATED. Do not edit.
extension SalahPhrases {
  static let arabicGenerated: [String] = [
${phrases.map(s => `    ${JSON.stringify(s)}`).join(",\n")}
  ]
}`;
fs.writeFileSync("ios/App/WidgetExtension/Phrases.generated.swift", swift);
```
Then reference `arabicGenerated` from the widget. Eliminates drift.

### 8. Clear `logcat.txt` from the repo root
1.4 MB of noise. Add to `.gitignore`.

---

## Medium effort, meaningful improvements

### 9. Translate the English iOS widget pool
Pick 30–50 high-quality English Salawat / blessings translations and replace the 6-item array. Rough hour to do well.

### 10. Add a "Preview" button to the Settings screen
`OverlayPlugin.showPreview` already exists in Java but isn't called. A button in the permission section that lets the user trigger one preview overlay would be a confidence-boost — "yes, I've granted permission, this is what the popup will look like."

### 11. Better foreground-service notification
Empty notifications are flagged by Play Store policy and look broken on OEM launchers. Replace with:
- Title: `t("salah_reminder")` ("اللهم صل وسلم على نبينا محمد")
- Subtitle: app description
- Tap action: open MainActivity
- Use the gold star icon, not `ic_dialog_info`.

### 12. Make the iOS widget tappable
Add `widgetURL(URL(string: "salahapp://"))` modifier to the entry view; handle deep link in `AppDelegate.application(_:open:options:)` to navigate to a "phrase detail" or "share blessing" view.

### 13. Add a "Share blessing" button
Opens a system share sheet with the current phrase. Simple `Share` Capacitor plugin call, but high virality value for an Islamic app.

### 14. Phrase favorites
Long-press a phrase on the overlay → save to favorites. Simple UX; gives users agency. Stored in another SharedPreferences key.

### 15. Per-user phrase ordering
Today phrases cycle linearly. Adding a Fisher-Yates shuffle when the user first opens the app gives each user a different rotation while still touching every phrase before repeating.

### 16. Per-day phrase pinning
"Phrase of the day" — derive index from `(daysSinceEpoch) % count` so all users see the same Salawat each calendar day. Could become a shareable focal point.

---

## Larger projects

### 17. Replace the foreground-service notification with a wake-lock-safe AlarmManager pattern
The current foreground service is needed *only* to register the `ACTION_USER_PRESENT` runtime receiver (manifest-declared receivers don't get this broadcast). An alternative: schedule precise alarms via `AlarmManager.setExactAndAllowWhileIdle` and skip the FG service entirely. Pro: no permanent notification, no battery-optimizer fights. Con: precise alarms have their own quotas on Android 12+.

This is a real architectural decision worth discussing.

### 18. Add an Android home-screen widget
Same idea as the iOS widget. Glance API (`androidx.glance:glance-appwidget`) is straightforward in Compose, but the rest of the codebase is plain Java. Could be Java + RemoteViews for consistency.

### 19. Add prayer-time integration
The folder name is `salahapp/` and the project is Islamic — but there's no actual prayer-time logic. A natural extension:
- Use a free prayer-time library (e.g. `adhan` npm package; pure-JS, works in Node and browser)
- Show daily prayer times in the settings UI
- Optionally: silence the unlock overlay during scheduled prayer windows (so it doesn't interrupt the user mid-prayer)

### 20. Cloud-synced favorites + custom phrases
Once the app has favorites and any backend, syncing across devices becomes a feature. Firebase Auth (anonymous) + Firestore is overkill for a hobby app, but Supabase row-level-security or a single Cloud Function would do it.

### 21. Quran citations
For each phrase, display the source (hadith reference, scholar attribution). Adds depth + scholarly credibility. Static lookup table; ship with the binary.

### 22. Audio recitation
Tap the overlay → hear a one-line audio recitation of the Salawat. Bundle 333 small MP3s (~1–2 MB each) or stream from a CDN. Premium-feeling but increases binary size.

### 23. Donation / Sadaqah Jariyah CTA
The natural monetization for an Islamic-purpose-only app is donations. A "Support development → Sadaqah Jariyah" link routes to a verified charity. Avoid in-app payment if possible (App Store fees + scope).

### 24. Multi-language expansion
Add Indonesian (Bahasa), Urdu, Turkish — high-volume Muslim languages currently under-served by Salawat-reminder apps in the stores.

---

## Architectural notes I'd push back on

- **Don't introduce Redux/Zustand** for this app — it's a 200-line settings screen. `useState` + Capacitor Preferences is exactly right.
- **Don't migrate Java → Kotlin** unless you're doing meaningful work on the native side. The current Java is short, clear, and works. Conversion adds risk for cosmetic gain.
- **Don't add a backend** for the v1 use case. The trojan-horse foreground-service architecture is the moat — every server-backed alternative would be a tracking liability for the user.
- **Don't generate the iOS widget via `cap sync`** even if a plugin offers it. The author already discovered (and warned about in `iOS_SETUP_GUIDE.md`) that programmatic `.pbxproj` edits corrupt the project.

---

## How I'd prioritize for a v1.1 release

1. Fix iOS widget language gap (#1)
2. Translate English iOS phrases (#9)
3. Better foreground-service notification (#11)
4. Make widget tappable (#12)
5. Stop hourly timer immediately on toggle (#6)
6. Phrase generation script (#7)
7. Lint TS files + strict mode (#2, #3)

That's a focused, high-value sprint. Everything else is nice-to-have.
