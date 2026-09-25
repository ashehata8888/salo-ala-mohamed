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

// Voice reminder: the Android build plays a clip from an AlarmManager receiver.
// iOS has no equivalent background audio, so the clip becomes the sound of a
// local notification instead. The ringer switch and ringer volume apply, just as
// Android skips playback on silent/vibrate. Voice gets whatever is left of the
// 64-notification budget after the visual reminder.
const VOICE_ID_BASE = 1200;
const IOS_PENDING_LIMIT = 64;
const VOICE_SOUND = "sali_voice.caf";
const DEFAULT_VOICE_SCHEDULES: VoiceSchedule[] = [
  { days: [1, 2, 3, 4, 5, 6, 7], startMinutes: 540, endMinutes: 1380 },
];

// days use Calendar.DAY_OF_WEEK numbering (1 = Sunday … 7 = Saturday), which is
// also what a Capacitor `on.weekday` trigger expects.
export type VoiceSchedule = {
  days: number[];
  startMinutes: number;
  endMinutes: number;
};

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
    ...Array.from({ length: IOS_PENDING_LIMIT }, (_, i) => ({
      id: VOICE_ID_BASE + i,
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

  const timerEnabled =
    (await Preferences.get({ key: "enable_active_timer" })).value !== "false";
  const voiceEnabled =
    (await Preferences.get({ key: "enable_hourly_voice" })).value === "true";
  if (!timerEnabled && !voiceEnabled) return;

  if (!(await ensureNotificationPermission())) return;

  const lang = (await Preferences.get({ key: "user_lang" })).value ?? "ar";
  const pool = lang === "ar" ? salahPhrases : salahPhrasesEn;
  if (!pool.length) return;

  const title = lang === "ar" ? "صلِّ على محمد ﷺ" : "Prophet Salah Reminder";

  let visualCount = 0;
  if (timerEnabled) {
    const reducePref = await Preferences.get({ key: "reducePopupFrequency" });
    const stepHours = reducePref.value === "true" ? 2 : 1;

    const pausePref = await Preferences.get({ key: "pauseUntil" });
    const pauseUntil = parseInt(pausePref.value ?? "0", 10) || 0;

    visualCount =
      pauseUntil > Date.now()
        ? await scheduleOneShotsAfterPause(
            pool,
            title,
            stepHours,
            pauseUntil,
            voiceEnabled ? ONESHOT_COUNT / 2 : ONESHOT_COUNT,
          )
        : await scheduleRepeatingSlots(pool, title, stepHours);
  }

  if (voiceEnabled) {
    await scheduleVoiceSlots(pool, title, IOS_PENDING_LIMIT - visualCount);
  }
}

// Mirrors HourlyVoiceReceiver: fire every `frequency` inside each active
// window, on the window's days. Slots are aligned to the window start rather
// than to "now + interval", so the same times repeat every day or week.
async function scheduleVoiceSlots(
  pool: string[],
  title: string,
  budget: number,
): Promise<void> {
  if (budget <= 0) return;

  const freqPref = await Preferences.get({ key: "voiceFrequency" });
  const stepMinutes = Math.max(
    15,
    Math.round((parseInt(freqPref.value ?? "3600000", 10) || 3600000) / 60000),
  );

  let schedules = DEFAULT_VOICE_SCHEDULES;
  const schedulesPref = await Preferences.get({ key: "voice_schedules" });
  if (schedulesPref.value) {
    try {
      schedules = JSON.parse(schedulesPref.value) as VoiceSchedule[];
    } catch {
      /* keep the default window */
    }
  }

  // weekday -> set of minute-of-day slots
  const slotsByDay = new Map<number, Set<number>>();
  for (const { days, startMinutes, endMinutes } of schedules) {
    // A window whose end is before its start wraps past midnight.
    const span = (endMinutes - startMinutes + 1440) % 1440;
    for (const day of days) {
      for (let offset = 0; offset <= span; offset += stepMinutes) {
        const minute = startMinutes + offset;
        const weekday = minute >= 1440 ? (day % 7) + 1 : day;
        const set = slotsByDay.get(weekday) ?? new Set<number>();
        set.add(minute % 1440);
        slotsByDay.set(weekday, set);
      }
    }
  }
  if (!slotsByDay.size) return;

  const everyDaySame =
    slotsByDay.size === 7 &&
    [...slotsByDay.values()].every(
      (set) =>
        set.size === slotsByDay.get(1)!.size &&
        [...set].every((m) => slotsByDay.get(1)!.has(m)),
    );

  const dayOffset = Math.floor(Date.now() / DAY_MS);
  const phrase = (i: number) => pool[(dayOffset * 7 + i) % pool.length];
  const base = { title, sound: VOICE_SOUND };

  // Repeating triggers never expire, so prefer them whenever they fit.
  if (everyDaySame && slotsByDay.get(1)!.size <= budget) {
    const minutes = [...slotsByDay.get(1)!].sort((a, b) => a - b);
    await LocalNotifications.schedule({
      notifications: minutes.map((m, i) => ({
        ...base,
        id: VOICE_ID_BASE + i,
        body: phrase(i),
        schedule: {
          on: { hour: Math.floor(m / 60), minute: m % 60 },
          repeats: true,
          allowWhileIdle: true,
        },
      })),
    });
    return;
  }

  const weekly: { weekday: number; minute: number }[] = [];
  for (const [weekday, set] of slotsByDay) {
    for (const minute of set) weekly.push({ weekday, minute });
  }

  if (weekly.length <= budget) {
    await LocalNotifications.schedule({
      notifications: weekly.map(({ weekday, minute }, i) => ({
        ...base,
        id: VOICE_ID_BASE + i,
        body: phrase(i),
        schedule: {
          on: { weekday, hour: Math.floor(minute / 60), minute: minute % 60 },
          repeats: true,
          allowWhileIdle: true,
        },
      })),
    });
    return;
  }

  // Too many slots for repeating triggers: schedule the next `budget` dated
  // occurrences. Every launch tops this back up.
  const upcoming: Date[] = [];
  const now = new Date();
  for (let d = 0; d < 14 && upcoming.length < budget; d++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    const minutes = [...(slotsByDay.get(date.getDay() + 1) ?? [])].sort(
      (a, b) => a - b,
    );
    for (const m of minutes) {
      const at = new Date(date.getTime());
      at.setHours(Math.floor(m / 60), m % 60, 0, 0);
      if (at.getTime() > now.getTime()) upcoming.push(at);
      if (upcoming.length >= budget) break;
    }
  }
  await LocalNotifications.schedule({
    notifications: upcoming.map((at, i) => ({
      ...base,
      id: VOICE_ID_BASE + i,
      body: phrase(i),
      schedule: { at, allowWhileIdle: true },
    })),
  });
}

// Steady state: a repeating daily trigger per hour slot. Never expires.
async function scheduleRepeatingSlots(
  pool: string[],
  title: string,
  stepHours: number,
): Promise<number> {
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
  return notifications.length;
}

// While a pause is pending: dated one-shots starting at the first whole hour
// after it ends. Covers ~2.5 days, by which point the repeating set is restored
// on the next launch.
async function scheduleOneShotsAfterPause(
  pool: string[],
  title: string,
  stepHours: number,
  pauseUntil: number,
  count: number,
): Promise<number> {
  const intervalMs = stepHours * HOUR_MS;
  let fireMs = Math.ceil(pauseUntil / HOUR_MS) * HOUR_MS;
  if (fireMs <= Date.now()) fireMs += intervalMs;

  const notifications = [];
  for (let i = 0; i < count; i++) {
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
  return notifications.length;
}
