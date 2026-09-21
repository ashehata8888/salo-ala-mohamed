import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Preferences } from "@capacitor/preferences";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { salahPhrases } from "./salahPhrases";
import { salahPhrasesEn } from "./salahPhrasesEn";
import { OnboardingFlow } from "./OnboardingFlow";
import { rescheduleSalahNotifications } from "./iosNotifications";
import { Calendar } from 'primereact/calendar';
import 'primereact/resources/themes/lara-dark-amber/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import "./main.scss";

type VoiceSchedule = {
  days: number[];
  startMinutes: number;
  endMinutes: number;
};

// ─── Plugin ───────────────────────────────────────────────────────────────────
const OverlayPlugin = registerPlugin("OverlayPlugin");

const platform = Capacitor.getPlatform();
const isAndroid = platform === "android";
const isIos = platform === "ios";

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getPhraseAtIndex(phrases: string[], index: number): string {
  if (!phrases.length) return "";
  return phrases[index % phrases.length];
}

// ─── Component ────────────────────────────────────────────────────────────────
function App() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  // Derive active phrase array from current language (index is preserved on switch)
  const activePhrases = i18n.language === "ar" ? salahPhrases : salahPhrasesEn;

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isBatteryOptimized, setIsBatteryOptimized] = useState<boolean | null>(
    null,
  );
  const [isTimerEnabled, setIsTimerEnabled] = useState(true);
  const [isHourlyVoiceEnabled, setIsHourlyVoiceEnabled] = useState(false);
  const [popupSpeed, setPopupSpeed] = useState("medium");
  const [reduceFrequency, setReduceFrequency] = useState(false);
  const [pauseUntil, setPauseUntil] = useState<number>(0);
  const [selectedPauseDuration, setSelectedPauseDuration] =
    useState<string>("");
  const [currentTime, setCurrentTime] = useState(Date.now());
  // permissionsChecked: false until the FIRST live checkPermission() call completes
  const [permissionsChecked, setPermissionsChecked] = useState(false);
  const calendarRefs = useRef<{[key: string]: any}>({});
  const [activeCalendarId, setActiveCalendarId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"visual" | "voice">("visual");
  const [voiceFrequency, setVoiceFrequency] = useState<number>(3600000);
  const [voiceSchedules, setVoiceSchedules] = useState<VoiceSchedule[]>([]);
  const [voiceVolume, setVoiceVolume] = useState<number>(0.5);

  const [tempVoiceSchedules, setTempVoiceSchedules] = useState<VoiceSchedule[] | null>(null);

  const latestSchedules = useRef(voiceSchedules);
  latestSchedules.current = voiceSchedules;
  const latestVisible = useRef(activeCalendarId);
  latestVisible.current = activeCalendarId;
  const latestTempSchedules = useRef(tempVoiceSchedules);
  latestTempSchedules.current = tempVoiceSchedules;
  const pendingTimeUpdate = useRef<{ startMinutes: number, endMinutes: number } | null>(null);

  const closeCalendarRef = useRef<() => void>();
  closeCalendarRef.current = () => {
    const activeId = latestVisible.current;
    if (activeId && latestTempSchedules.current) {
      syncVoiceSchedules(latestTempSchedules.current);
    }
    setActiveCalendarId(null);
    setTempVoiceSchedules(null);
    if (activeId && calendarRefs.current[activeId]) {
      calendarRefs.current[activeId].hide?.();
    }
  };

  const openCalendar = (id: string) => {
    setActiveCalendarId(id);
    setTempVoiceSchedules(JSON.parse(JSON.stringify(latestSchedules.current)));
  };

  // ── Click Outside to Close & Scroll to Close ──
  useEffect(() => {
    const handleClickOutside = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.p-datepicker') && !target.closest('.custom-calendar')) {
        if (latestVisible.current) {
          closeCalendarRef.current?.();
        }
      }
    };

    const handleScroll = () => {
      if (latestVisible.current) {
        closeCalendarRef.current?.();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, []);

  // ── Invisible Overlay Hijacking (Rapid-Fire) ──
  useEffect(() => {
    let timer: any;
    let interval: any;
    let lastFireTime = 0;

    const stopFiring = () => {
      clearTimeout(timer);
      clearInterval(interval);
    };

    const handleShieldDown = (e: Event, type: 'hour' | 'minute', dir: 'up' | 'down', span: HTMLElement) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (e.cancelable) e.preventDefault(); // Stop PrimeReact from getting it
      
      const now = Date.now();
      if (now - lastFireTime < 50) return; // Deduplicate ghost events
      lastFireTime = now;

      stopFiring();

      const activeKey = latestVisible.current;
      if (!activeKey) return;
      const [idxStr, timeType] = activeKey.split('-');
      const idx = parseInt(idxStr);

      const updateTime = () => {
        const currentSchedules = latestTempSchedules.current || latestSchedules.current;
        const schedule = currentSchedules[idx];
        if (!schedule) return;
        
        let currentMins = pendingTimeUpdate.current !== null 
            ? (timeType === 'start' ? pendingTimeUpdate.current.startMinutes : pendingTimeUpdate.current.endMinutes)
            : (timeType === 'start' ? schedule.startMinutes : schedule.endMinutes);
        
        let h = Math.floor(currentMins / 60);
        let m = currentMins % 60;

        if (type === 'hour') {
           if (dir === 'up') h = (h + 1) % 24;
           else h = (h - 1 + 24) % 24;
        } else {
           if (dir === 'up') m = (m + 1) % 60;
           else m = (m - 1 + 60) % 60;
        }
        
        const newTotal = h * 60 + m;
        
        let newStart = timeType === 'start' ? newTotal : (pendingTimeUpdate.current ? pendingTimeUpdate.current.startMinutes : schedule.startMinutes);
        let newEnd = timeType === 'end' ? newTotal : (pendingTimeUpdate.current ? pendingTimeUpdate.current.endMinutes : schedule.endMinutes);
        
        if (timeType === 'start') {
            if (newStart >= newEnd) {
                newEnd = Math.min(newStart + 60, 1439);
                if (newStart >= newEnd) newStart = newEnd - 1;
            }
        } else {
            if (newEnd === 0) newEnd = 1439;
            if (newEnd <= newStart) {
                newStart = Math.max(newEnd - 60, 0);
                if (newEnd <= newStart) newEnd = newStart + 1;
            }
        }
        
        pendingTimeUpdate.current = { startMinutes: newStart, endMinutes: newEnd };

        // Update DOM for instant feedback (only for the active picker we are touching)
        const timepicker = span.closest('.p-timepicker');
        if (timepicker) {
           const activeMins = timeType === 'start' ? newStart : newEnd;
           const activeH = Math.floor(activeMins / 60);
           const activeM = activeMins % 60;
           
           const hSpan = timepicker.querySelector('.p-hour-picker > span');
           const mSpan = timepicker.querySelector('.p-minute-picker > span');
           const ampmSpan = timepicker.querySelector('.p-ampm-picker > span');
           
           if (hSpan) hSpan.textContent = (activeH % 12 || 12).toString().padStart(2, '0');
           if (mSpan) mSpan.textContent = activeM.toString().padStart(2, '0');
           if (ampmSpan) ampmSpan.textContent = activeH >= 12 ? 'PM' : 'AM';
        }
        
        // Push intermediate changes to React so secondary UI reflects boundary shifts instantly
        const tempNew = JSON.parse(JSON.stringify(currentSchedules));
        tempNew[idx].startMinutes = newStart;
        tempNew[idx].endMinutes = newEnd;
        setTempVoiceSchedules(tempNew);
      };

      // Initial tap
      updateTime();

      // Hold
      timer = setTimeout(() => {
        interval = setInterval(updateTime, 75);
      }, 400);
    };

    const handleGlobalUp = () => {
      stopFiring();
      if (pendingTimeUpdate.current !== null) {
          const activeKey = latestVisible.current;
          if (activeKey) {
              const [idxStr] = activeKey.split('-');
              const idx = parseInt(idxStr);
              const currentSchedules = latestTempSchedules.current || latestSchedules.current;
              const newSchedules = JSON.parse(JSON.stringify(currentSchedules));
              if (newSchedules[idx]) {
                  newSchedules[idx].startMinutes = pendingTimeUpdate.current.startMinutes;
                  newSchedules[idx].endMinutes = pendingTimeUpdate.current.endMinutes;
                  
                  // Update temporary state instead of syncing instantly
                  // @ts-ignore
                  setTempVoiceSchedules(newSchedules);
              }
          }
          pendingTimeUpdate.current = null;
      }
    };

    document.addEventListener('pointerup', handleGlobalUp);
    document.addEventListener('touchend', handleGlobalUp);
    document.addEventListener('touchcancel', handleGlobalUp);
    document.addEventListener('mouseup', handleGlobalUp);

    // MutationObserver to inject shields
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes.length) {
          const timepickers = document.querySelectorAll('.p-timepicker:not(.shielded)');
          timepickers.forEach(tp => {
            tp.classList.add('shielded');
            const buttons = tp.querySelectorAll('button');
            buttons.forEach(btn => {
               // Skip AM/PM
               if (btn.closest('.p-ampm-picker')) return;
               
               btn.style.userSelect = 'none';
               // @ts-ignore
               btn.style.WebkitUserSelect = 'none';
               // @ts-ignore
               btn.style.WebkitTouchCallout = 'none';
               
               const type = btn.closest('.p-hour-picker') ? 'hour' : 'minute';
               // If the button is the first element, it's the Up arrow. If not, it's the Down arrow.
               const dir = (btn === btn.parentElement!.firstElementChild) ? 'up' : 'down';
               const span = btn.parentElement!.querySelector('span') as HTMLElement;

               // Attach directly to the button element in the capture phase to intercept before React
               const downHandler = (e: Event) => handleShieldDown(e, type as 'hour'|'minute', dir as 'up'|'down', span);
               btn.addEventListener('pointerdown', downHandler, { capture: true });
               btn.addEventListener('touchstart', downHandler, { passive: false, capture: true });
               btn.addEventListener('mousedown', downHandler, { capture: true });
               
               // Also capture and stop 'click' so PrimeReact ignores any residual events
               btn.addEventListener('click', (e) => { 
                   e.stopPropagation(); 
                   e.stopImmediatePropagation(); 
                   if (e.cancelable) e.preventDefault(); 
               }, { capture: true });
            });
          });
        }
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener('pointerup', handleGlobalUp);
      document.removeEventListener('touchend', handleGlobalUp);
      document.removeEventListener('touchcancel', handleGlobalUp);
      document.removeEventListener('mouseup', handleGlobalUp);
      observer.disconnect();
      stopFiring();
    };
  }, []);


  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // ── On mount: LIVE permission check — routing is derived from this, not cache ─
  useEffect(() => {
    (async () => {
      // Non-Android: skip all native checks, go straight to dashboard
      if (!isAndroid) {
        setHasPermission(true);
        setIsBatteryOptimized(true);
        setPermissionsChecked(true);
        return;
      }

      // Optimistically seed from cache so the loading shield disappears faster,
      // then overwrite immediately with the live result below.
      try {
        const cached = await Preferences.get({
          key: "overlay_permission_granted",
        });
        if (cached.value !== null) {
          setHasPermission(cached.value === "true");
        }
      } catch {
        /* ignore */
      }

      // ── LIVE check (always runs, never skipped) ─────────────────────────────
      await checkPermission();

      // Mark the initial check done → OnboardingFlow can now render with
      // verified permission states (no stale-cache false-positive).
      setPermissionsChecked(true);

      console.log("[App] Initial permission check complete.");
    })();

    // Safety: if native bridge hangs, unblock UI after 4 s
    const timer = setTimeout(() => {
      setPermissionsChecked(true);
      setHasPermission((prev) => (prev === null ? false : prev));
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  // ── Load other preferences ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const tabPref = await Preferences.get({ key: "lastActiveTab" });
      if (tabPref.value !== null) {
        setActiveTab(tabPref.value as "visual" | "voice");
      } else {
        setActiveTab("voice");
        await Preferences.set({ key: "lastActiveTab", value: "voice" });
      }

      const timerPref = await Preferences.get({ key: "enable_active_timer" });
      if (timerPref.value !== null) {
        setIsTimerEnabled(timerPref.value === "true");
      } else {
        await Preferences.set({ key: "enable_active_timer", value: "true" });
      }

      const speedPref = await Preferences.get({ key: "popup_speed" });
      if (speedPref.value !== null) {
        setPopupSpeed(speedPref.value);
      } else {
        await Preferences.set({ key: "popup_speed", value: "medium" });
      }

      const reducePref = await Preferences.get({ key: "reducePopupFrequency" });
      if (reducePref.value !== null) {
        setReduceFrequency(reducePref.value === "true");
      } else {
        await Preferences.set({ key: "reducePopupFrequency", value: "false" });
      }

      const hourlyVoicePref = await Preferences.get({ key: "enable_hourly_voice" });
      if (hourlyVoicePref.value !== null) {
        setIsHourlyVoiceEnabled(hourlyVoicePref.value === "true");
        if (isAndroid) {
          if (hourlyVoicePref.value === "true") {
            try { await (OverlayPlugin as any).startHourlyVoice(); } catch(e) {}
          } else {
            try { await (OverlayPlugin as any).cancelHourlyVoice(); } catch(e) {}
          }
        }
      } else {
        setIsHourlyVoiceEnabled(true);
        await Preferences.set({ key: "enable_hourly_voice", value: "true" });
        if (isAndroid) {
          try { await (OverlayPlugin as any).startHourlyVoice(); } catch(e) {}
        }
      }

      
      const vfPref = await Preferences.get({ key: "voiceFrequency" });
      if (vfPref.value !== null) {
        setVoiceFrequency(parseInt(vfPref.value, 10));
      } else {
        setVoiceFrequency(3600000);
        await Preferences.set({ key: "voiceFrequency", value: "3600000" });
      }

      const schedulesPref = await Preferences.get({ key: "voice_schedules" });
      if (schedulesPref.value !== null) {
        setVoiceSchedules(JSON.parse(schedulesPref.value));
      } else {
        const vshPref = await Preferences.get({ key: "voiceStartHour" });
        const vehPref = await Preferences.get({ key: "voiceEndHour" });
        const vadPref = await Preferences.get({ key: "voiceActiveDays" });
        
        const startHour = vshPref.value !== null ? parseInt(vshPref.value, 10) : 9;
        const endHour = vehPref.value !== null ? parseInt(vehPref.value, 10) : 23;
        const activeDays = vadPref.value !== null ? JSON.parse(vadPref.value) : [1,2,3,4,5,6,7];
        
        const initialSchedule: VoiceSchedule = {
            days: activeDays,
            startMinutes: startHour * 60,
            endMinutes: endHour * 60
        };
        setVoiceSchedules([initialSchedule]);
        await Preferences.set({ key: "voice_schedules", value: JSON.stringify([initialSchedule]) });
      }

      const vvPref = await Preferences.get({ key: "voiceVolume" });
      if (vvPref.value !== null) setVoiceVolume(parseFloat(vvPref.value));

      const pausePref = await Preferences.get({ key: "pauseUntil" });
      if (pausePref.value !== null) {
        setPauseUntil(parseInt(pausePref.value, 10));
      }

      const pauseDurationPref = await Preferences.get({
        key: "selectedPauseDuration",
      });
      if (pauseDurationPref.value !== null) {
        setSelectedPauseDuration(pauseDurationPref.value);
      }

      // Sync phrases to native layer (using language-aware array)
      const lang = (await Preferences.get({ key: "user_lang" })).value ?? "ar";
      const phrases = lang === "ar" ? salahPhrases : salahPhrasesEn;
      await Preferences.set({
        key: "salah_phrases",
        value: JSON.stringify(phrases),
      });

      if (isAndroid) {
        try {
          await (OverlayPlugin as any).syncSettings({
            userLang: lang,
            salahPhrases: phrases,
            enableActiveTimer: timerPref.value === "true",
            enableHourlyVoice: hourlyVoicePref.value !== null ? hourlyVoicePref.value === "true" : true,

            voiceFrequency: vfPref.value !== null ? parseInt(vfPref.value, 10) : 3600000,
            voiceSchedules: schedulesPref.value !== null ? schedulesPref.value : JSON.stringify([{ days: [1,2,3,4,5,6,7], startMinutes: 540, endMinutes: 1380 }]),
            voiceVolume: vvPref.value !== null ? parseFloat(vvPref.value) : 0.5,

            popupSpeed: speedPref.value !== null ? speedPref.value : "medium",
            reducePopupFrequency: reducePref.value === "true",
            pauseUntil: pausePref.value !== null ? parseInt(pausePref.value, 10) : 0
          });
        } catch (e) {
          console.error("Failed to initial sync settings to native", e);
        }
      }

      // iOS reminder = local notifications. Top up the rolling schedule on
      // every launch once preferences (timer/frequency/pause) are loaded.
      await rescheduleSalahNotifications();
    })();
  }, []);

  // ── RTL ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
  }, [i18n.language]);

  // ── Permission helpers ─────────────────────────────────────────────────────
  const checkPermission = async () => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android")
      return;
    try {
      const result = await (OverlayPlugin as any).checkPermission();
      setHasPermission(result.granted);
      await Preferences.set({
        key: "overlay_permission_granted",
        value: result.granted.toString(),
      });

      const batteryResult = await (
        OverlayPlugin as any
      ).isBatteryOptimizationIgnored();
      setIsBatteryOptimized(batteryResult.isIgnored);
    } catch (e) {
      console.error("Checking permission failed", e);
    }
  };

  useEffect(() => {
    // This function runs when the Native Java side sends the 'refreshPermissions' nudge
    const handleNativeRefresh = async () => {
      console.log("[App] Native nudge received. Checking battery state...");
      await checkPermission();
    };

    // This function runs immediately when the app enters the foreground
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        // 1. We check preferences immediately (very light on hardware)
        const [pausePref, pauseDurationPref] = await Promise.all([
          Preferences.get({ key: "pauseUntil" }),
          Preferences.get({ key: "selectedPauseDuration" }),
        ]);

        if (pausePref.value !== null)
          setPauseUntil(parseInt(pausePref.value, 10));
        if (pauseDurationPref.value !== null)
          setSelectedPauseDuration(pauseDurationPref.value);

        // Note: We do NOT call checkPermission() here.
        // We wait for the 'refreshPermissions' event from MainActivity.java
        // which is timed perfectly to bypass the Android PowerManager lag.
      }
    };

    window.addEventListener("refreshPermissions", handleNativeRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("refreshPermissions", handleNativeRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkPermission]);

  const requestPermission = async () => {
    if (
      !Capacitor.isNativePlatform() ||
      Capacitor.getPlatform() !== "android"
    ) {
      alert("This feature is only available on Android native app.");
      return;
    }
    try {
      const result = await (OverlayPlugin as any).requestPermission();
      setHasPermission(result.granted);
      await Preferences.set({
        key: "overlay_permission_granted",
        value: result.granted.toString(),
      });
    } catch (e) {
      console.error("Requesting permission failed", e);
    }
  };

  const requestBatteryPermission = async () => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android")
      return;
    try {
      const result = await (
        OverlayPlugin as any
      ).requestIgnoreBatteryOptimization();
      if (result.requested) {
        // Checking status directly might not be instant if they haven't answered the prompt yet,
        // but visibilitychange event listener will re-check it when they come back to the app.
      }
    } catch (e) {
      console.error("Requesting battery permission failed", e);
    }
  };

  // ── Language ───────────────────────────────────────────────────────────────
  const changeLanguage = async (lng: string) => {
    localStorage.setItem("user_lang", lng);
    await i18n.changeLanguage(lng);
    await Preferences.set({ key: "user_lang", value: lng });

    // Re-sync the correct phrase array to the native layer on language switch.
    // currentIndex is NOT reset — phrase #N in Arabic maps to phrase #N in English.
    const phrases = lng === "ar" ? salahPhrases : salahPhrasesEn;
    await Preferences.set({
      key: "salah_phrases",
      value: JSON.stringify(phrases),
    });

    if (isAndroid) {
      try {
        await (OverlayPlugin as any).syncSettings({ userLang: lng, salahPhrases: phrases });
      } catch (e) {
        console.error("Failed to sync language settings to native", e);
      }
    }

    // iOS: re-issue notifications in the newly selected language.
    await rescheduleSalahNotifications();
  };

  // ── Timer toggle ───────────────────────────────────────────────────────────
  const toggleTimer = async () => {
    const newValue = !isTimerEnabled;
    setIsTimerEnabled(newValue);
    await Preferences.set({
      key: "enable_active_timer",
      value: newValue.toString(),
    });
    if (isAndroid) {
      try { await (OverlayPlugin as any).syncSettings({ enableActiveTimer: newValue }); } catch (e) {}
    }
    await rescheduleSalahNotifications();
  };

  
  const syncVoiceSettings = async (updates: any) => {
    for (const key in updates) {
      const val = updates[key];
      await Preferences.set({ key, value: typeof val === 'object' ? JSON.stringify(val) : val.toString() });
      if (key === 'voiceFrequency') setVoiceFrequency(val);
      if (key === 'voiceVolume') setVoiceVolume(val);
    }
    if (isAndroid) {
      try { await (OverlayPlugin as any).syncSettings({
        voiceFrequency: updates.voiceFrequency !== undefined ? updates.voiceFrequency : voiceFrequency,
        voiceVolume: updates.voiceVolume !== undefined ? updates.voiceVolume : voiceVolume
      }); } catch (e) {}
      if (isHourlyVoiceEnabled && updates.voiceFrequency !== undefined) {
        try { await (OverlayPlugin as any).startHourlyVoice(); } catch(e) {}
      }
    }
  };

  const syncVoiceSchedules = async (newSchedules: VoiceSchedule[]) => {
    setVoiceSchedules(newSchedules);
    const val = JSON.stringify(newSchedules);
    await Preferences.set({ key: "voice_schedules", value: val });
    if (isAndroid) {
      try { await (OverlayPlugin as any).syncSettings({ voiceSchedules: val }); } catch (e) {}
      if (isHourlyVoiceEnabled) {
        try { await (OverlayPlugin as any).startHourlyVoice(); } catch(e) {}
      }
    }
  };

  const handleTestVolume = (vol: number) => {
    try {
      if (isAndroid) {
        (OverlayPlugin as any).playPreviewSound({ volume: vol }).catch((error: any) => {
          console.error("Audio bridge failed:", error);
        });
      } else {
        const audio = new Audio('/sali_voice.mp3');
        audio.volume = vol;
        audio.play().catch(e => console.error("Audio preview failed:", e));
      }
    } catch (error) {
      console.error("Audio bridge failed:", error);
    }
  };


  // ── Hourly Voice Toggle ────────────────────────────────────────────────────
  const toggleHourlyVoice = async () => {
    const newValue = !isHourlyVoiceEnabled;
    setIsHourlyVoiceEnabled(newValue);
    await Preferences.set({
      key: "enable_hourly_voice",
      value: newValue.toString(),
    });
    if (isAndroid) {
      try { await (OverlayPlugin as any).syncSettings({ enableHourlyVoice: newValue }); } catch (e) {}
      if (newValue) {
        try { await (OverlayPlugin as any).startHourlyVoice(); } catch (e) {}
      } else {
        try { await (OverlayPlugin as any).cancelHourlyVoice(); } catch (e) {}
      }
    }
  };

  // ── Speed ──────────────────────────────────────────────────────────────────
  const changeSpeed = async (speed: string) => {
    setPopupSpeed(speed);
    await Preferences.set({ key: "popup_speed", value: speed });
    if (isAndroid) {
      try { await (OverlayPlugin as any).syncSettings({ popupSpeed: speed }); } catch (e) {}
    }
  };

  // ── Frequency Toggle ───────────────────────────────────────────────────────
  const handleToggleFrequency = async () => {
    const newValue = !reduceFrequency;
    setReduceFrequency(newValue);
    await Preferences.set({
      key: "reducePopupFrequency",
      value: newValue.toString(),
    });
    if (isAndroid) {
      try { await (OverlayPlugin as any).syncSettings({ reducePopupFrequency: newValue }); } catch (e) {}
    }
    await rescheduleSalahNotifications();
  };

  // ── Deep Sleep ─────────────────────────────────────────────────────────────
  const handlePauseOverlay = async (minutes: number) => {
    // Android: the native OverlayPlugin owns pause state + AlarmManager resume.
    if (isAndroid) {
      try {
        const result = await (OverlayPlugin as any).pauseOverlay({ minutes });
        if (result.success) {
          setPauseUntil(result.pauseUntil);
          setSelectedPauseDuration(minutes.toString());
          await Preferences.set({
            key: "selectedPauseDuration",
            value: minutes.toString(),
          });
          await Preferences.set({
            key: "pauseUntil",
            value: result.pauseUntil.toString(),
          });
          if (minutes <= 0) {
            await (OverlayPlugin as any).syncSettings({ pauseUntil: 0 });
          }
        }
      } catch (e) {
        console.error("Failed to pause overlay", e);
      }
      return;
    }

    // iOS: pause = skip the notification window, then reschedule after it.
    if (isIos) {
      const newPauseUntil = minutes > 0 ? Date.now() + minutes * 60 * 1000 : 0;
      const durationValue = minutes > 0 ? minutes.toString() : "";
      setPauseUntil(newPauseUntil);
      setSelectedPauseDuration(durationValue);
      await Preferences.set({
        key: "pauseUntil",
        value: newPauseUntil.toString(),
      });
      await Preferences.set({
        key: "selectedPauseDuration",
        value: durationValue,
      });
      await rescheduleSalahNotifications();
      return;
    }

    alert("This feature is only available on the mobile app.");
  };

  // (No onComplete callback needed — routing is derived from live permission
  //  states. When both are true, App.tsx automatically shows the dashboard.)

  // ── Render ─────────────────────────────────────────────────────────────────
  // Block until the LIVE permission check finishes (prevents stale-cache skip)
  if (!permissionsChecked) {
    return <div className="glass-container loading-shield" />;
  }

  // Android-only: strict gate — route is derived ONLY from live permission state.
  // No persisted flag. If either permission is ungranted → onboarding.
  if (isAndroid && (!hasPermission || isBatteryOptimized === false)) {
    // initialStep: start at Step 1 (overlay) unless overlay is already verified.
    const initialStep: 0 | 1 = hasPermission === true ? 1 : 0;
    console.log(
      `[App] Routing to OnboardingFlow — initialStep=${initialStep}`,
      `| overlay=${hasPermission} | battery_ignored=${isBatteryOptimized}`,
    );
    return (
      <OnboardingFlow
        initialStep={initialStep}
        hasPermission={hasPermission}
        isBatteryOptimized={isBatteryOptimized}
        checkPermission={checkPermission}
        requestPermission={requestPermission}
        requestBatteryPermission={requestBatteryPermission}
        changeLanguage={changeLanguage}
      />
    );
  }

  return (
    <div className={`glass-container ${isRtl ? "rtl" : "ltr"} ${activeTab === "voice" && isHourlyVoiceEnabled ? "voice-mode" : "visual-mode"}`}>
      {/* ── Language Selector ── */}
      <div className="onboarding-lang-container" onClick={() => changeLanguage(i18n.language === "ar" ? "en" : "ar")} style={{ position: 'absolute', insetBlockStart: '20px', insetInlineEnd: '20px', marginTop: 0 }}>
        <span className="lang-label-target">{isRtl ? "EN" : "AR"}</span>
        <button className="onboarding-lang-btn" aria-label="Toggle language">
          🌐
        </button>
      </div>

      {/* ── Header ── */}
      <div className="app-header">
        <h1>{t("app_title")}</h1>
        {/* <p className="description">{t("salah_desc")}</p> */}
        <div>
          <h4 className="basmala">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</h4>
          <span className="quran">
            {
              "إِنَّ اللَّهَ وَمَلَائِكَتَهُ يُصَلُّونَ عَلَى النَّبِيِّ ۚ يَا أَيُّهَا الَّذِينَ آمَنُوا صَلُّوا عَلَيْهِ وَسَلِّمُوا تَسْلِيمًا"
            }
          </span>
        </div>
      </div>

      
      {/* ── Settings section ── */}
      <div className={`settings-section ${isRtl ? "rtl" : "ltr"}`}>
        <div className="tabs-container">
          <button 
            className={`tab-btn ${activeTab === "visual" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("visual");
              Preferences.set({ key: "lastActiveTab", value: "visual" });
            }}
          >
            {isRtl ? "التذكير المرئي" : "Visual Reminder"}
          </button>
          <button 
            className={`tab-btn ${activeTab === "voice" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("voice");
              Preferences.set({ key: "lastActiveTab", value: "voice" });
            }}
          >
            {isRtl ? "التذكير الصوتي" : "Voice Reminder"}
          </button>
        </div>

        {activeTab === "visual" && (
          <div className="tab-content">
            {/* Popup Speed */}
            {!isIos && (
              <div className="action-row">
                <div className="action-text">
                  <h3 className="action-title">
                    {isRtl ? "سرعة الإظهار" : "Popup Speed"}
                  </h3>
                  <p className="action-desc">
                    {isRtl
                      ? "تحديد مدة بقاء التذكير"
                      : "Select how long the popup stays visible"}
                  </p>
                </div>
                <div className="dropdown-container">
                  <select
                    value={popupSpeed}
                    onChange={(e) => changeSpeed(e.target.value)}
                    className="speed-dropdown"
                  >
                    <option value="slow">{isRtl ? "بطيء" : "Slow"}</option>
                    <option value="medium">{isRtl ? "متوسط" : "Medium"}</option>
                    <option value="fast">{isRtl ? "سريع" : "Fast"}</option>
                  </select>
                </div>
              </div>
            )}

            {/* 1-Hour Timer */}
            <div className="action-row">
              <div className="action-text">
                <h3 className="action-title">
                  {isRtl ? "تذكير كل ساعة" : "Hourly Reminder"}
                </h3>
                <p className="action-desc">
                  {isRtl
                    ? "إظهار التذكير كل ساعة أثناء الاستخدام"
                    : "Show popup every hour during active use"}
                </p>
              </div>
              <button
                className={`toggle-btn ${isTimerEnabled ? "toggle-on" : "toggle-off"}`}
                onClick={toggleTimer}
              >
                <span className="toggle-thumb" />
              </button>
            </div>

            {/* Reduce Popup Frequency Section */}
            <div className="action-row">
              <div className="action-text">
                <h3 className="action-title">
                  {isRtl ? "تقليل مرات الظهور" : "Reduce Popup Frequency"}
                </h3>
                <p className="action-desc">
                  {isRtl
                    ? "إظهار التذكير كل مرتين تفتح فيهم هاتفك"
                    : "Show the popup every second time you unlock your mobile"}
                </p>
              </div>

              <button
                className={`toggle-btn ${reduceFrequency ? "toggle-on" : "toggle-off"}`}
                onClick={handleToggleFrequency}
              >
                <span className="toggle-thumb" />
              </button>
            </div>

            {/* Temporary Pause Section */}
            <div className="action-row temp-pause-section">
              <div className="dropdown-pause-container">
                <div className="action-text">
                  <h3 className="action-title">
                    {isRtl ? "إيقاف مؤقت" : "Temp Pause"}
                  </h3>
                  {currentTime < pauseUntil ? (
                    <p className="action-desc status">
                      <label> {isRtl ? "الحالة:" : "Status:"}</label>{" "}
                      {currentTime < pauseUntil
                        ? isRtl
                          ? "متوقف مؤقتاً"
                          : "Paused"
                        : isRtl
                          ? "نشط"
                          : "Active"}
                    </p>
                  ) : (
                    <p className="action-desc">
                      {isRtl
                        ? "سيتم أعادة تفعيل التذكير تلقائيا"
                        : "Will be resumed automatically"}
                    </p>
                  )}
                </div>

                <div className="dropdown-container">
                  <select
                    value={currentTime < pauseUntil ? selectedPauseDuration : ""}
                    onChange={(e) => {
                      if (e.target.value) {
                        handlePauseOverlay(parseInt(e.target.value, 10));
                      }
                    }}
                    className="speed-dropdown"
                  >
                    <option value="" disabled>
                      {isRtl ? "اختر المدة" : "Select Duration"}
                    </option>
                    <option value="1440">{isRtl ? "يوم واحد" : "1 Day"}</option>
                    <option value="2880">{isRtl ? "يومان" : "2 Days"}</option>
                    <option value="4320">{isRtl ? "ثلاثة ايام" : "3 Days"}</option>
                  </select>
                </div>
              </div>

              {currentTime < pauseUntil && (
                <div className="cancel-pause-container">
                  <p className="action-desc" style={{ margin: 0 }}>
                    {isRtl ? "إلغاء الإيقاف" : "Cancel Pause"}
                  </p>
                  <button
                    className="toggle-btn toggle-off"
                    onClick={() => {
                      if (currentTime < pauseUntil) {
                        handlePauseOverlay(0);
                      }
                    }}
                    disabled={currentTime >= pauseUntil}
                    style={{ opacity: currentTime < pauseUntil ? 1 : 0.4 }}
                  >
                    <span className="toggle-thumb" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "voice" && (
          <div className="tab-content">
            <div className="action-row">
              <div className="action-text">
                <h3 className="action-title">
                  {isRtl ? "تذكير صوتي" : "Voice Reminder"}
                </h3>
                <p className="action-desc">
                  {isRtl
                    ? "تشغيل التذكير الصوتي"
                    : "Play voice reminder"}
                </p>
              </div>
              <button
                className={`toggle-btn ${isHourlyVoiceEnabled ? "toggle-on" : "toggle-off"}`}
                onClick={toggleHourlyVoice}
              >
                <span className="toggle-thumb" />
              </button>
            </div>

            {isHourlyVoiceEnabled && (
              <div className="voice-advanced-controls">
                <div className="control-item row-layout">
                  <label>{isRtl ? "تكرار التذكير كل" : "Frequency"}</label>
                  <select 
                    value={voiceFrequency.toString()} 
                    onChange={(e) => syncVoiceSettings({ voiceFrequency: Number(e.target.value) })}
                    className="speed-dropdown"
                  >
                    <option value="1800000">{isRtl ? "30 دقيقة" : "30 Mins"}</option>
                    <option value="3600000">{isRtl ? "ساعة واحدة" : "1 Hour"}</option>
                    <option value="7200000">{isRtl ? "ساعتان" : "2 Hours"}</option>
                  </select>
                </div>
                <hr style={{ border: 'none', borderBottom: '1px solid var(--border-mid)', margin: '0' }} />

                <div className="control-item col-layout">
                  <div className="schedules-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ margin: 0 }}>{isRtl ? "فترات عمل التذكير" : "Reminder Active Periods"}</label>
                  </div>
                  {(() => {
                    const allSelectedDays = new Set(voiceSchedules.flatMap(s => s.days));
                    const isAddDisabled = voiceSchedules.length >= 7 || allSelectedDays.size === 7;
                    
                    const pausedDays = [1,2,3,4,5,6,7].filter(d => !allSelectedDays.has(d));
                    let pausedText = "";
                    if (pausedDays.length > 0) {
                        const dayNames = {
                          en: ["", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
                          ar: ["", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
                        };
                        const separator = isRtl ? " و " : " and ";
                        const names = pausedDays.map(d => isRtl ? dayNames.ar[d] : dayNames.en[d]);
                        const joinedNames = names.length > 1 ? names.slice(0, -1).join(", ") + separator + names[names.length - 1] : names[0];
                        pausedText = isRtl 
                          ? `الإشعارات الصوتية متوقفة يوم ${joinedNames}.` 
                          : `Voice reminders are paused on ${joinedNames}.`;
                    }

                    const displaySchedules = tempVoiceSchedules || voiceSchedules;

                    return (
                      <>
                        {displaySchedules.map((schedule, idx) => {
                          const startTime = new Date();
                    startTime.setHours(Math.floor(schedule.startMinutes / 60), schedule.startMinutes % 60, 0, 0);
                    const endTime = new Date();
                    endTime.setHours(Math.floor(schedule.endMinutes / 60), schedule.endMinutes % 60, 0, 0);

                    return (
                      <div key={idx} className="schedule-slot" dir="ltr" style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '12px', marginBottom: '10px' }}>
                        <div className="time-pickers" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px', justifyContent: 'center' }}>
                          <Calendar 
                            ref={(el) => { if (el) calendarRefs.current[`${idx}-start`] = el; }}
                            visible={activeCalendarId === `${idx}-start`}
                            onVisibleChange={(e) => {
                                if (!e.visible && activeCalendarId === `${idx}-start`) {
                                    closeCalendarRef.current?.();
                                }
                            }}
                            onClick={() => {
                                if (activeCalendarId !== `${idx}-start`) {
                                    openCalendar(`${idx}-start`);
                                }
                            }}
                            value={startTime} 
                            onChange={(e) => {
                                if (e.value) {
                                    let newMins = e.value.getHours() * 60 + e.value.getMinutes();
                                    let endMins = displaySchedules[idx].endMinutes;
                                    
                                    if (newMins >= endMins) {
                                        endMins = Math.min(newMins + 60, 1439);
                                        if (newMins >= endMins) {
                                            newMins = endMins - 1;
                                        }
                                    }
                                    
                                    const newSchedules = JSON.parse(JSON.stringify(displaySchedules));
                                    newSchedules[idx] = { ...newSchedules[idx], startMinutes: newMins, endMinutes: endMins };
                                    setTempVoiceSchedules(newSchedules);
                                }
                            }} 
                            timeOnly 
                            hourFormat="12" 
                            readOnlyInput
                            locale="en"
                            panelClassName="ltr-calendar-panel start-calendar-popup"
                            footerTemplate={() => (
                                <button className="calendar-set-btn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); closeCalendarRef.current?.(); }} style={{width: '100%', padding: '12px', background: 'var(--gold-mid)', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 'bold'}}>
                                    Set
                                </button>
                            )}
                            className="custom-calendar"
                          />
                          <i className="pi pi-arrow-right time-sep" style={{ color: 'var(--gold-mid)', fontSize: '1rem', margin: '0 5px' }}></i>
                          <Calendar 
                            ref={(el) => { if (el) calendarRefs.current[`${idx}-end`] = el; }}
                            visible={activeCalendarId === `${idx}-end`}
                            onVisibleChange={(e) => {
                                if (!e.visible && activeCalendarId === `${idx}-end`) {
                                    closeCalendarRef.current?.();
                                }
                            }}
                            onClick={() => {
                                if (activeCalendarId !== `${idx}-end`) {
                                    openCalendar(`${idx}-end`);
                                }
                            }}
                            value={endTime} 
                            onChange={(e) => {
                                if (e.value) {
                                    let newMins = e.value.getHours() * 60 + e.value.getMinutes();
                                    
                                    if (newMins === 0) {
                                        newMins = 1439;
                                    }

                                    let startMins = displaySchedules[idx].startMinutes;
                                    if (newMins <= startMins) {
                                        startMins = Math.max(newMins - 60, 0);
                                        if (newMins <= startMins) {
                                            newMins = startMins + 1;
                                        }
                                    }

                                    const newSchedules = JSON.parse(JSON.stringify(displaySchedules));
                                    newSchedules[idx] = { ...newSchedules[idx], startMinutes: startMins, endMinutes: newMins };
                                    setTempVoiceSchedules(newSchedules);
                                }
                            }} 
                            timeOnly 
                            hourFormat="12" 
                            readOnlyInput
                            locale="en"
                            panelClassName="ltr-calendar-panel end-calendar-popup"
                            footerTemplate={() => (
                                <button className="calendar-set-btn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); closeCalendarRef.current?.(); }} style={{width: '100%', padding: '12px', background: 'var(--gold-mid)', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 'bold'}}>
                                    Set
                                </button>
                            )}
                            className="custom-calendar"
                          />
                          {voiceSchedules.length > 1 && (
                            <button 
                              onClick={() => {
                                const newSchedules = [...voiceSchedules];
                                newSchedules.splice(idx, 1);
                                syncVoiceSchedules(newSchedules);
                              }}
                              style={{ background: 'none', border: 'none', color: '#ff4444', fontSize: '20px', cursor: 'pointer', padding: '0 5px' }}
                            >
                              <i className="pi pi-times-circle"></i>
                            </button>
                          )}
                        </div>
                        <div className="days-row" style={{ justifyContent: 'center' }}>
                          {[
                            { val: 1, ar: "أح", en: "Su" },
                            { val: 2, ar: "إث", en: "Mo" },
                            { val: 3, ar: "ثل", en: "Tu" },
                            { val: 4, ar: "أر", en: "We" },
                            { val: 5, ar: "خم", en: "Th" },
                            { val: 6, ar: "جم", en: "Fr" },
                            { val: 7, ar: "سب", en: "Sa" }
                          ].map(day => {
                            const isSelectedInThisCard = schedule.days.includes(day.val);
                            const isSelectedInOtherCard = !isSelectedInThisCard && allSelectedDays.has(day.val);

                            return (
                              <button 
                                key={day.val}
                                className={`day-btn ${isSelectedInThisCard ? "active" : ""}`}
                                disabled={isSelectedInOtherCard}
                                style={{ opacity: isSelectedInOtherCard ? 0.3 : 1, cursor: isSelectedInOtherCard ? 'not-allowed' : 'pointer' }}
                                onClick={() => {
                                  const active = schedule.days.includes(day.val);
                                  // Prevent creating empty "ghost" cards
                                  if (active && schedule.days.length === 1) return;
                                  const nextDays = active ? schedule.days.filter(d => d !== day.val) : [...schedule.days, day.val];
                                  const newSchedules = [...voiceSchedules];
                                  newSchedules[idx] = { ...newSchedules[idx], days: nextDays };
                                  syncVoiceSchedules(newSchedules);
                                }}
                              >
                                {day.en}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {pausedDays.length > 0 && (
                    <p style={{
                      fontSize: '0.85rem',
                      color: 'var(--text-secondary)',
                      textAlign: 'center',
                      margin: '10px 0',
                      fontStyle: 'italic',
                      lineHeight: '1.4'
                    }}>
                      {pausedText}
                    </p>
                  )}

                  <button 
                    className="add-schedule-btn"
                    disabled={isAddDisabled}
                    onClick={() => {
                        const availableDays = [1,2,3,4,5,6,7].filter(d => !allSelectedDays.has(d));
                        const newSchedules = [...voiceSchedules, { days: availableDays, startMinutes: 540, endMinutes: 1380 }];
                        syncVoiceSchedules(newSchedules);
                    }}
                    style={{ 
                        background: 'transparent', 
                        border: isAddDisabled ? 'none' : '1px dashed var(--gold-primary)', 
                        color: isAddDisabled ? 'rgba(255, 215, 0, 0.2)' : 'var(--gold-primary)', 
                        padding: '10px', 
                        borderRadius: '12px', 
                        cursor: isAddDisabled ? 'not-allowed' : 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '8px', 
                        marginTop: '5px' 
                    }}
                  >
                    <i className="pi pi-plus"></i>
                    {isRtl ? "إضافة فترة أخرى" : "Add another period"}
                  </button>
                  <hr style={{ border: 'none', borderBottom: '1px solid var(--border-mid)', margin: '0' }} />
                  </>
                );
              })()}
                </div>

                <div className="control-item col-layout">
                  <label className="vol-label">
                    {isRtl ? "مستوى الصوت" : "Volume"} 
                    <span className="vol-percent">{Math.round(voiceVolume * 100)}%</span>
                  </label>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05" 
                    value={voiceVolume} 
                    onChange={(e) => setVoiceVolume(Number(e.target.value))}
                    onTouchEnd={(e) => {
                      const vol = Number((e.target as HTMLInputElement).value);
                      syncVoiceSettings({ voiceVolume: vol });
                      handleTestVolume(vol);
                    }}
                    onMouseUp={(e) => {
                      const vol = Number((e.target as HTMLInputElement).value);
                      syncVoiceSettings({ voiceVolume: vol });
                      handleTestVolume(vol);
                    }}
                    className="volume-slider"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

{/* ── Permission section — only rendered when NOT granted ── */}
      {isAndroid && (!hasPermission || isBatteryOptimized === false) && (
        <div
          className={`settings-section permission-section ${isRtl ? "rtl" : "ltr"}`}
        >
          <span className="section-label">{t("permission")}</span>

          {!hasPermission && (
            <>
              <div className="action-row">
                <div className="action-text">
                  <h3 className="action-title">{t("draw_over_apps")}</h3>
                  <p className="action-desc">{t("draw_over_apps_desc")}</p>
                </div>
              </div>
              <div className="action-row">
                <button onClick={requestPermission} className="grant-btn pulse">
                  <span className="btn-icon">🔓</span>
                  {t("grant_permission")}
                </button>
              </div>
            </>
          )}

          {isBatteryOptimized === false && (
            <>
              <div className="action-row">
                <div className="action-text">
                  <h3 className="action-title">
                    {isRtl
                      ? "السماح بالعمل في الخلفية"
                      : "Allow Background Activity"}
                  </h3>
                  <p className="action-desc">
                    {isRtl
                      ? "يرجى تعطيل تحسين البطارية لضمان ظهور التذكير بشكل دائم."
                      : "Please disable battery optimization to ensure the reminder always works."}
                  </p>
                </div>
              </div>
              <div className="action-row">
                <button
                  onClick={requestBatteryPermission}
                  className="grant-btn pulse"
                >
                  <span className="btn-icon">🔋</span>
                  {isRtl ? "منح الصلاحية" : "Grant Permission"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
