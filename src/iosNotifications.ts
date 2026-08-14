import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { LocalNotifications } from "@capacitor/local-notifications";
import { salahPhrases } from "./salahPhrases";
import { salahPhrasesEn } from "./salahPhrasesEn";

// iOS allows max 64 pending local notifications; 60 keeps headroom and gives
// ~2.5 days of hourly coverage. The app tops the schedule up on every launch.
const NOTIF_ID_BASE = 1000;
const NOTIF_COUNT = 60;
const HOUR_MS = 60 * 60 * 1000;

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

// Rebuilds the rolling iOS notification schedule from the current settings.
// Mirrors the Android reminder: hourly Salawat, frequency/pause aware.
export async function rescheduleSalahNotifications(): Promise<void> {
  if (!isIos()) return;

  // Clear our previously scheduled batch (deterministic id range).
  const batchIds = Array.from({ length: NOTIF_COUNT }, (_, i) => ({
    id: NOTIF_ID_BASE + i,
  }));
  try {
    await LocalNotifications.cancel({ notifications: batchIds });
  } catch {
    /* nothing pending — ignore */
  }

  const timerPref = await Preferences.get({ key: "enable_active_timer" });
  if (timerPref.value === "false") return; // hourly reminder disabled

  if (!(await ensureNotificationPermission())) return;

  const lang = (await Preferences.get({ key: "user_lang" })).value ?? "ar";
  const pool = lang === "ar" ? salahPhrases : salahPhrasesEn;
  if (!pool.length) return;

  const reducePref = await Preferences.get({ key: "reducePopupFrequency" });
  const intervalMs = reducePref.value === "true" ? 2 * HOUR_MS : HOUR_MS;

  const pausePref = await Preferences.get({ key: "pauseUntil" });
  const pauseUntil = parseInt(pausePref.value ?? "0", 10) || 0;

  // First fire: next whole hour after max(now, pauseUntil).
  const earliest = Math.max(Date.now(), pauseUntil);
  let fireMs = Math.ceil(earliest / HOUR_MS) * HOUR_MS;
  if (fireMs <= Date.now()) fireMs += HOUR_MS;

  const title = lang === "ar" ? "صلِّ على محمد ﷺ" : "Prophet Salah Reminder";
  const notifications = [];
  for (let i = 0; i < NOTIF_COUNT; i++) {
    // Rotate by wall-clock hour — same scheme the widget uses.
    const index = Math.floor(fireMs / HOUR_MS) % pool.length;
    notifications.push({
      id: NOTIF_ID_BASE + i,
      title,
      body: pool[index],
      schedule: { at: new Date(fireMs) },
    });
    fireMs += intervalMs;
  }

  await LocalNotifications.schedule({ notifications });
}
