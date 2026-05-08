import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Preferences } from "@capacitor/preferences";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { salahPhrases } from "./salahPhrases";
import "./main.scss";

// ─── Plugin ───────────────────────────────────────────────────────────────────
const OverlayPlugin = registerPlugin("OverlayPlugin");

const platform = Capacitor.getPlatform();
const isAndroid = platform === 'android';
const isIos = platform === 'ios';

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getPhraseAtIndex(phrases: string[], index: number): string {
  if (!phrases.length) return "";
  return phrases[index % phrases.length];
}

// ─── Component ────────────────────────────────────────────────────────────────
function App() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isBatteryOptimized, setIsBatteryOptimized] = useState<boolean | null>(null);
  const [isTimerEnabled, setIsTimerEnabled] = useState(true);
  const [popupSpeed, setPopupSpeed] = useState("medium");
  const [reduceFrequency, setReduceFrequency] = useState(false);
  const [pauseUntil, setPauseUntil] = useState<number>(0);
  const [selectedPauseDuration, setSelectedPauseDuration] = useState<string>("");
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // ── On mount: load persisted permission state immediately ──────────────────
  useEffect(() => {
    (async () => {
      try {
        const cached = await Preferences.get({ key: "overlay_permission_granted" });
        setHasPermission(cached.value === "true" ? true : false);
      } catch {
        setHasPermission(false);
      }
      await checkPermission();
    })();

    const timer = setTimeout(() => {
      setHasPermission((prev) => (prev === null ? false : prev));
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // ── Load other preferences ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
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

      const pausePref = await Preferences.get({ key: "pauseUntil" });
      if (pausePref.value !== null) {
        setPauseUntil(parseInt(pausePref.value, 10));
      }

      const pauseDurationPref = await Preferences.get({ key: "selectedPauseDuration" });
      if (pauseDurationPref.value !== null) {
        setSelectedPauseDuration(pauseDurationPref.value);
      }

      // Sync static phrases to native layer
      await Preferences.set({
        key: "salah_phrases",
        value: JSON.stringify(salahPhrases),
      });
    })();
  }, []);

  // ── RTL ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
  }, [i18n.language]);

  // ── Permission helpers ─────────────────────────────────────────────────────
  const checkPermission = async () => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
    try {
      const result = await (OverlayPlugin as any).checkPermission();
      setHasPermission(result.granted);
      await Preferences.set({
        key: "overlay_permission_granted",
        value: result.granted.toString(),
      });

      const batteryResult = await (OverlayPlugin as any).isBatteryOptimizationIgnored();
      setIsBatteryOptimized(batteryResult.isIgnored);
    } catch (e) {
      console.error("Checking permission failed", e);
    }
  };

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        checkPermission();
        const pausePref = await Preferences.get({ key: "pauseUntil" });
        if (pausePref.value !== null) {
          setPauseUntil(parseInt(pausePref.value, 10));
        }
        const pauseDurationPref = await Preferences.get({ key: "selectedPauseDuration" });
        if (pauseDurationPref.value !== null) {
          setSelectedPauseDuration(pauseDurationPref.value);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const requestPermission = async () => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
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
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
    try {
      const result = await (OverlayPlugin as any).requestIgnoreBatteryOptimization();
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
  };

  // ── Timer toggle ───────────────────────────────────────────────────────────
  const toggleTimer = async () => {
    const newValue = !isTimerEnabled;
    setIsTimerEnabled(newValue);
    await Preferences.set({ key: "enable_active_timer", value: newValue.toString() });
  };

  // ── Speed ──────────────────────────────────────────────────────────────────
  const changeSpeed = async (speed: string) => {
    setPopupSpeed(speed);
    await Preferences.set({ key: "popup_speed", value: speed });
  };

  // ── Frequency Toggle ───────────────────────────────────────────────────────
  const handleToggleFrequency = async () => {
    const newValue = !reduceFrequency;
    setReduceFrequency(newValue);
    await Preferences.set({ key: "reducePopupFrequency", value: newValue.toString() });
  };

  // ── Deep Sleep ─────────────────────────────────────────────────────────────
  const handlePauseOverlay = async (minutes: number) => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      alert("This feature is only available on Android native app.");
      return;
    }
    try {
      const result = await (OverlayPlugin as any).pauseOverlay({ minutes });
      if (result.success) {
        setPauseUntil(result.pauseUntil);
        setSelectedPauseDuration(minutes.toString());
        await Preferences.set({ key: "selectedPauseDuration", value: minutes.toString() });
      }
    } catch (e) {
      console.error("Failed to pause overlay", e);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (hasPermission === null) {
    return <div className="glass-container loading-shield" />;
  }

  return (
    <div className={`glass-container ${isRtl ? "rtl" : "ltr"}`}>
      {/* ── Header ── */}
      <div className="app-header">
        <h1>{t("app_title")}</h1>
        <p className="description">{t("salah_desc")}</p>
        <div>
          <h4 className="basmala">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</h4>
          <span className="quran">
            {"إِنَّ اللَّهَ وَمَلَائِكَتَهُ يُصَلُّونَ عَلَى النَّبِيِّ ۚ يَا أَيُّهَا الَّذِينَ آمَنُوا صَلُّوا عَلَيْهِ وَسَلِّمُوا تَسْلِيمًا"}
          </span>
        </div>
      </div>

      {/* ── Settings section ── */}
      <div className={`settings-section ${isRtl ? "rtl" : "ltr"}`}>
        <span className="section-label">{t("settings")}</span>

        {/* Language */}
        <div className="action-row">
          <div className="action-text">
            <h3 className="action-title">{t("language")}</h3>
          </div>
          <div className="lang-toggle">
            <button
              className={`lang-btn ${i18n.language === "ar" ? "active" : ""}`}
              onClick={() => changeLanguage("ar")}
            >
              {t("arabic")}
            </button>
            <button
              className={`lang-btn ${i18n.language === "en" ? "active" : ""}`}
              onClick={() => changeLanguage("en")}
            >
              {t("english")}
            </button>
          </div>
        </div>

        {/* Popup Speed */}
        <div className="action-row">
          <div className="action-text">
            <h3 className="action-title">
              {isRtl ? "سرعة الإظهار" : "Popup Speed"}
            </h3>
            <p className="action-desc">
              {isRtl ? "تحديد مدة بقاء التذكير" : "Select how long the popup stays visible"}
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

        {/* 1-Hour Timer */}
        <div className="action-row">
          <div className="action-text">
            <h3 className="action-title">
              {isRtl ? "تذكير كل ساعة" : "Hourly Reminder"}
            </h3>
            <p className="action-desc">
              {isRtl ? "إظهار التذكير كل ساعة أثناء الاستخدام" : "Show popup every hour during active use"}
            </p>
          </div>
          <button
            className={`toggle-btn ${isTimerEnabled ? "toggle-on" : "toggle-off"}`}
            onClick={toggleTimer}
          >
            <span className="toggle-thumb" />
          </button>
        </div>

        {/* ── Popup Frequency Section ── */}
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

        {/* ── Temporary Pause Section ── */}

        <div className="action-row">
          <div className="action-text">
            <h3 className="action-title">
              {isRtl ? "إيقاف مؤقت لمدة" : "Temp Pause for"}
            </h3>
            {currentTime < pauseUntil ? (
              <p className="action-desc status">
               <label>   {isRtl ? "الحالة:" : "Status:"}</label> {currentTime < pauseUntil ? (isRtl ? "متوقف مؤقتاً" : "Paused") : (isRtl ? "نشط" : "Active")}
              
                {/* {isRtl ? "سيستأنف في " : "Resumes in "}
                {Math.ceil((pauseUntil - currentTime) / 60000)} {isRtl ? "دقيقة" : "min"} */}
              </p>
            ) : (
              <p className="action-desc">
                {isRtl ? "سيتم أعادة تفعيل التذكير تلقائيا" : "Will be resumed automatically"}
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
              <option value="" disabled>{isRtl ? "اختر" : "Select"}</option>
              <option value="1440">{isRtl ? "يوم واحد" : "1 Day"}</option>
              <option value="2880">{isRtl ? "يومان" : "2 Days"}</option>
              <option value="4320">{isRtl ? "ثلاثة ايام" : "3 Days"}</option>
              <option value="0">{isRtl ? "إلغاء الإيقاف" : "Cancel Pause"}</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Permission section — only rendered when NOT granted ── */}
      {isAndroid && (!hasPermission || isBatteryOptimized === false) && (
        <div className={`settings-section permission-section ${isRtl ? "rtl" : "ltr"}`}>
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
                    {isRtl ? "السماح بالعمل في الخلفية" : "Allow Background Activity"}
                  </h3>
                  <p className="action-desc">
                    {isRtl
                      ? "يرجى تعطيل تحسين البطارية لضمان ظهور التذكير بشكل دائم."
                      : "Please disable battery optimization to ensure the reminder always works."}
                  </p>
                </div>
              </div>
              <div className="action-row">
                <button onClick={requestBatteryPermission} className="grant-btn pulse">
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
