# Local Documentation — صلِّ على محمد ﷺ

Comprehensive, working-knowledge documentation of the Salo ala Mohamed app. **Local-only — do not commit if the repo is not yours.** These notes are written so you can reason about behavior, debug issues, and propose improvements without re-reading every file.

## Read order

1. **[01-overview.md](./01-overview.md)** — what the app is, who it's for, its three user-facing surfaces
2. **[02-architecture.md](./02-architecture.md)** — system diagram + every component's role
3. **[03-data-flow.md](./03-data-flow.md)** — every preference key, who writes, who reads, **bugs in the wiring**
4. **[04-web-layer.md](./04-web-layer.md)** — React UI, i18n, permission flow
5. **[05-android.md](./05-android.md)** — overlay rendering, foreground service, boot resilience, the Capacitor plugin
6. **[06-ios-widget.md](./06-ios-widget.md)** — WidgetKit timeline, App Group, manual setup
7. **[07-build-and-deploy.md](./07-build-and-deploy.md)** — build/sync/run on each platform
8. **[08-known-issues.md](./08-known-issues.md)** — bugs, footguns, behavioral surprises uncovered during this audit
9. **[09-improvement-ideas.md](./09-improvement-ideas.md)** — prioritized suggestions

## Quick mental model

- The app is a **trojan horse for one Android system overlay**. The webview UI is just a glorified settings panel.
- iOS gets a separate, much simpler experience: **a home-screen widget** built on WidgetKit. The widget code is **independent** from the web/Android logic — same theme, different data path.
- Cross-layer state lives in `CapacitorStorage` SharedPreferences (Android) and `NSUserDefaults.standard` (iOS). There is **no backend**, **no IPC**, **no analytics**, **no auth**.
- All Salawat phrases are hardcoded in the binary — no network calls.

## Where to start when investigating a bug

| Symptom | Start here |
|---------|-----------|
| Overlay not appearing on unlock | [05-android.md § Service & Overlay](./05-android.md#foreground-service) |
| Overlay shows wrong language | [03-data-flow.md § user_lang](./03-data-flow.md#user_lang) |
| Settings change doesn't reach native | [03-data-flow.md § preference keys](./03-data-flow.md#preference-keys) |
| Service dies after reboot | [05-android.md § Boot resilience](./05-android.md#boot-resilience) |
| iOS widget shows wrong language | [08-known-issues.md § iOS widget can't see app language](./08-known-issues.md) — **this is a real bug** |
| Hourly timer not firing | [05-android.md § Timer logic](./05-android.md#hourly-timer) |
| Phrase repeats / skips | [03-data-flow.md § salah_index](./03-data-flow.md#salah_index) |
