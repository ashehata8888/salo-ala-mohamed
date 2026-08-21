import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { LocalNotifications } from "@capacitor/local-notifications";
import { salahPhrases } from "./salahPhrases";
import { salahPhrasesEn } from "./salahPhrasesEn";

// iOS caps an app at 64 pending local notifications and gives a non-running app
// no way to top the queue up. Scheduling 60 one-shot hourly notifications
// therefore bought ~2.5 days and then went silent until the user happened to
// reopen the app — the reminder simply stopped, with nothing to tell them.
//
// The steady-state schedule is now one *repeating* notification per hour slot
// (24 of them, or 12 when the frequency is reduced). A repeating calendar
// trigger fires at that hour every day for as long as the app is installed, so
// the reminder never expires on its own.
//
// The cost is that a phrase is pinned to its hour until the schedule is rebuilt.
// Re-opening the app rotates the whole set (see `dayOffset`), so a user who
// checks in occasionally still sees fresh phrases, and a user who never opens
// the app keeps getting reminded instead of getting nothing.
const REPEAT_ID_BASE = 1000;
const REPEAT_SLOT_COUNT = 24;

// A pause has a definite end, which a repeating trigger cannot express. While
// one is pending we fall back to dated one-shots that begin after it expires;
// the next launch returns the schedule to the repeating set above.
const ONESHOT_ID_BASE = 1100;
const ONESHOT_COUNT = 60;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function isIos(): boolean {
  return Capacitor.getPlatform() === "ios";
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isIos()) return false;
  const status = await LocalNotifications.checkPermissions();
  if (status.display === "granted") return true;
  const requested = await LocalNotifications.requestPermissions();
  return requested.display === "granted";
}

// Both id ranges are cleared every time so the two strategies can never leave
// stale notifications behind when the schedule switches between them.
async function cancelExistingBatch(): Promise<void> {
  const ids = [
    ...Array.from({ length: REPEAT_SLOT_COUNT }, (_, i) => ({
      id: REPEAT_ID_BASE + i,
    })),
    ...Array.from({ length: ONESHOT_COUNT }, (_, i) => ({
      id: ONESHOT_ID_BASE + i,
    })),
  ];
  try {
    await LocalNotifications.cancel({ notifications: ids });
  } catch {
    /* nothing pending — ignore */
  }
}

// Rebuilds the rolling iOS notification schedule from the current settings.
// Mirrors the Android reminder: hourly Salawat, frequency/pause aware.
export async function rescheduleSalahNotifications(): Promise<void> {
  if (!isIos()) return;

  await cancelExistingBatch();

  const timerPref = await Preferences.get({ key: "enable_active_timer" });
  if (timerPref.value === "false") return; // hourly reminder disabled

  if (!(await ensureNotificationPermission())) return;

  const lang = (await Preferences.get({ key: "user_lang" })).value ?? "ar";
  const pool = lang === "ar" ? salahPhrases : salahPhrasesEn;
  if (!pool.length) return;

  const reducePref = await Preferences.get({ key: "reducePopupFrequency" });
  const stepHours = reducePref.value === "true" ? 2 : 1;

  const title = lang === "ar" ? "صلِّ على محمد ﷺ" : "Prophet Salah Reminder";

  const pausePref = await Preferences.get({ key: "pauseUntil" });
  const pauseUntil = parseInt(pausePref.value ?? "0", 10) || 0;

  if (pauseUntil > Date.now()) {
    await scheduleOneShotsAfterPause(pool, title, stepHours, pauseUntil);
    return;
  }

  await scheduleRepeatingSlots(pool, title, stepHours);
}

// Steady state: a repeating daily trigger per hour slot. Never expires.
async function scheduleRepeatingSlots(
  pool: string[],
  title: string,
  stepHours: number,
): Promise<void> {
  const hours: number[] = [];
  for (let h = 0; h < 24; h += stepHours) hours.push(h);

  // Shifts the phrase set each calendar day the schedule is rebuilt, so the
  // rotation still moves for anyone who opens the app from time to time.
  const dayOffset = Math.floor(Date.now() / DAY_MS);

  const notifications = hours.map((hour, i) => ({
    id: REPEAT_ID_BASE + i,
    title,
    body: pool[(dayOffset * hours.length + i) % pool.length],
    schedule: {
      on: { hour, minute: 0 },
      repeats: true,
      allowWhileIdle: true,
    },
  }));

  await LocalNotifications.schedule({ notifications });
}

// While a pause is pending: dated one-shots starting at the first whole hour
// after it ends. Covers ~2.5 days, by which point the repeating set is restored
// on the next launch.
async function scheduleOneShotsAfterPause(
  pool: string[],
  title: string,
  stepHours: number,
  pauseUntil: number,
): Promise<void> {
  const intervalMs = stepHours * HOUR_MS;
  let fireMs = Math.ceil(pauseUntil / HOUR_MS) * HOUR_MS;
  if (fireMs <= Date.now()) fireMs += intervalMs;

  const notifications = [];
  for (let i = 0; i < ONESHOT_COUNT; i++) {
    // Rotate by wall-clock hour — same scheme the widget uses.
    const index = Math.floor(fireMs / HOUR_MS) % pool.length;
    notifications.push({
      id: ONESHOT_ID_BASE + i,
      title,
      body: pool[index],
      schedule: { at: new Date(fireMs) },
    });
    fireMs += intervalMs;
  }

  await LocalNotifications.schedule({ notifications });
}
