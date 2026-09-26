import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { App as CapacitorApp } from "@capacitor/app";

// ─── Types ────────────────────────────────────────────────────────────────────
interface OnboardingFlowProps {
  isExiting?: boolean;
  initialStep: 0 | 1 | 2;
  hasPermission: boolean | null;
  isBatteryOptimized: boolean | null;
  hasExactAlarmPermission: boolean | null;
  checkPermission: () => Promise<void>;
  requestPermission: () => Promise<void>;
  requestBatteryPermission: () => Promise<void>;
  requestExactAlarmPermission: () => Promise<void>;
  changeLanguage: (lng: string) => Promise<void>;
}

// ─── Skeleton: Overlay (Draw Over Apps) ──────────────────────────────────────
function OverlaySkeleton({ isRtl }: { isRtl: boolean }) {
  const appLabel = isRtl ? "صلِّ على محمد ﷺ" : "Sali Ala Mohamed";
  return (
    <div className="skeleton-screen" dir={isRtl ? "rtl" : "ltr"}>
      <div className="skeleton-header-bar">
        <div className="skeleton-bar skeleton-bar--short" />
      </div>
      {[...Array(2)].map((_, i) => (
        <div key={i} className="skeleton-row">
          <div className="skeleton-bar skeleton-bar--icon" />
          <div className="skeleton-text-group">
            <div className="skeleton-bar skeleton-bar--medium" />
            <div className="skeleton-bar skeleton-bar--thin" />
          </div>
          <div className="skeleton-switch">
            <span className="skeleton-switch-thumb" />
          </div>
        </div>
      ))}
      <div className="skeleton-row skeleton-row--highlight">
        <div className="skeleton-bar skeleton-bar--icon skeleton-bar--app-icon" />
        <div className="skeleton-text-group">
          <span className="skeleton-app-label">{appLabel}</span>
          <div
            className="skeleton-bar skeleton-bar--thin"
            style={{ width: "55%" }}
          />
        </div>
        <div className="skeleton-switch skeleton-switch--on">
          <span className="skeleton-switch-thumb skeleton-switch-thumb--on" />
        </div>
        <div className="hand-pointer hand-pointer--overlay" aria-hidden="true">
          👆
        </div>
      </div>
      <div className="skeleton-row">
        <div className="skeleton-bar skeleton-bar--icon" />
        <div className="skeleton-text-group">
          <div className="skeleton-bar skeleton-bar--medium" />
        </div>
        <div className="skeleton-switch">
          <span className="skeleton-switch-thumb" />
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton: Exact Alarm ──────────────────────────────────────────
function AlarmSkeleton({ isRtl }: { isRtl: boolean }) {
  const appLabel = isRtl ? "صلِّ على محمد ﷺ" : "Sali Ala Mohamed";
  return (
    <div className="skeleton-screen" dir={isRtl ? "rtl" : "ltr"}>
      <div className="skeleton-header-bar">
        <div className="skeleton-bar skeleton-bar--short" />
      </div>
      <div className="skeleton-row skeleton-row--highlight">
        <div className="skeleton-bar skeleton-bar--icon skeleton-bar--app-icon" style={{ borderRadius: '50%' }} />
        <div className="skeleton-text-group">
          <span className="skeleton-app-label">{appLabel}</span>
          <div
            className="skeleton-bar skeleton-bar--thin"
            style={{ width: "65%" }}
          />
        </div>
        <div className="skeleton-switch skeleton-switch--on">
          <span className="skeleton-switch-thumb skeleton-switch-thumb--on" />
        </div>
        <div className="hand-pointer hand-pointer--overlay" aria-hidden="true">
          👆
        </div>
      </div>
      <div className="skeleton-row">
        <div className="skeleton-bar skeleton-bar--icon" />
        <div className="skeleton-text-group">
          <div className="skeleton-bar skeleton-bar--medium" />
        </div>
        <div className="skeleton-switch">
          <span className="skeleton-switch-thumb" />
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton: Battery Optimization ──────────────────────────────────────────
function BatterySkeleton({ isRtl }: { isRtl: boolean }) {
  const appLabel = isRtl ? "صلِّ على محمد ﷺ" : "Sali Ala Mohamed";
  const labels = isRtl
    ? ["بلا قيود", "محسَّن", "مقيَّد"]
    : ["Unrestricted", "Optimized", "Restricted"];
  return (
    <div className="skeleton-screen" dir={isRtl ? "rtl" : "ltr"}>
      <div className="skeleton-header-bar">
        <div className="skeleton-bar skeleton-bar--short" />
      </div>
      <div className="skeleton-row">
        <div className="skeleton-bar skeleton-bar--icon skeleton-bar--app-icon" />
        <div className="skeleton-text-group">
          <span className="skeleton-app-label">{appLabel}</span>
          <div
            className="skeleton-bar skeleton-bar--thin"
            style={{ width: "45%" }}
          />
        </div>
      </div>
      <div className="skeleton-divider" />
      <div
        className="skeleton-radio-row skeleton-radio-row--highlight"
        style={{ position: "relative" }}
      >
        <div className="skeleton-radio skeleton-radio--selected" />
        <span className="skeleton-app-label">{labels[0]}</span>
        <div className="hand-pointer hand-pointer--battery" aria-hidden="true">
          👆
        </div>
      </div>
      {labels.slice(1).map((label, i) => (
        <div key={i} className="skeleton-radio-row">
          <div className="skeleton-radio" />
          <div className="skeleton-text-group">
            <div
              className="skeleton-bar skeleton-bar--medium"
              style={{ marginBottom: 4 }}
            />
            <span className="skeleton-radio-label">{label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function OnboardingFlow({
  isExiting,
  initialStep,
  hasPermission,
  isBatteryOptimized,
  hasExactAlarmPermission,
  checkPermission,
  requestPermission,
  requestBatteryPermission,
  requestExactAlarmPermission,
  changeLanguage,
}: OnboardingFlowProps) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  const [page, setPage] = useState<0 | 1 | 2>(initialStep);
  const [isSliding, setIsSliding] = useState(false);

  // ── Capacitor Lifecycle: Check permissions when returning to foreground ──
  useEffect(() => {
    const listener = CapacitorApp.addListener("appStateChange", async ({ isActive }) => {
      if (isActive) {
        console.log("[Onboarding] App is active, checking permissions...");
        await checkPermission();
      }
    });

    return () => {
      listener.then((l) => l.remove());
    };
  }, [checkPermission]);

  // ── Animation Helper ─────────────────────────────────────────────────────
  const slideToStep = useCallback((step: 1 | 2) => {
    if (isSliding || page >= step) return;
    setIsSliding(true);
    setTimeout(() => {
      setPage(step);
      setIsSliding(false);
    }, 400);
  }, [isSliding, page]);

  // ── Step Gatekeeper: Advance when granted ──────────────
  useEffect(() => {
    // If we are on Step 1 (Overlay) and Overlay is granted
    if (page === 0 && hasPermission === true) {
      // Which one is missing next? Alarm or Battery?
      if (hasExactAlarmPermission !== true) {
        slideToStep(1);
      } else if (isBatteryOptimized !== true) {
        slideToStep(2);
      }
    }
    // If we are on Step 2 (Alarm) and Alarm is granted
    else if (page === 1 && hasExactAlarmPermission === true) {
      if (isBatteryOptimized !== true) {
        slideToStep(2);
      }
    }
  }, [hasPermission, hasExactAlarmPermission, isBatteryOptimized, page, slideToStep]);

  const toggleLanguage = async () => {
    await changeLanguage(isRtl ? "en" : "ar");
  };

  const handleAction = async () => {
    if (page === 0) {
      await requestPermission();
    } else if (page === 1) {
      await requestExactAlarmPermission();
    } else {
      await requestBatteryPermission();
    }
  };

  const pages = [
    {
      title: isRtl ? "تفعيل النافذة" : "Enable Overlay",
      subtitle: isRtl ? (
        <>
          حتى يظهر التذكير على الشاشة يجب تفعيل إذن "العرض فوق التطبيقات". افتح
          الإعدادات ثم ابحث عن اسم التطبيق{" "}
          <span className="app-name-nowrap">صلِّ على محمد ﷺ</span> ثم قم بتفعيل
          الإذن.
        </>
      ) : (
        <>
          To show reminders on your screen, you must enable the "Display over
          other apps" permission. Open Settings, search for{" "}
          <span className="app-name-nowrap">"Sali Ala Mohamed"</span> and toggle
          the permission on.
        </>
      ),
      skeleton: <OverlaySkeleton isRtl={isRtl} />,
      btnText: isRtl ? "منح الإذن" : "Grant Permission",
      btnIcon: "🔓",
    },
    {
      title: isRtl ? "إذن التنبيهات" : "Alarms Permission",
      subtitle: isRtl ? (
        <>
          لضمان عمل التذكير الصوتي في وقته المحدد تماماً، يُرجى السماح للتطبيق بضبط التنبيهات.
        </>
      ) : (
        <>
          To ensure your voice reminders fire exactly on time, allow the app to set alarms.
        </>
      ),
      skeleton: <AlarmSkeleton isRtl={isRtl} />,
      btnText: isRtl ? "منح إذن التنبيهات" : "Grant Alarm Permission",
      btnIcon: "🔔",
    },
    {
      title: isRtl ? "تحسين البطارية" : "Battery Optimization",
      subtitle: isRtl ? (
        <>
          لضمان عمل التذكير في الخلفية دائماً، اختر{" "}
          <span className="app-name-nowrap">"بلا قيود"</span> من إعدادات بطارية
          التطبيق.
        </>
      ) : (
        <>
          To ensure reminders run reliably in the background, please select
          <span className="app-name-nowrap"> "Unrestricted" </span> in the app's
          battery settings.
        </>
      ),
      skeleton: <BatterySkeleton isRtl={isRtl} />,
      btnText: isRtl ? "ضبط إعدادات البطارية" : "Adjust Battery Settings",
      btnIcon: "🔋",
    },
  ];

  const current = pages[page];

  return (
    <div
      className={`onboarding-screen ${isRtl ? "rtl" : "ltr"} ${isExiting ? "exiting" : ""}`}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* ── Language Selector ── */}
      <div className="onboarding-lang-container" onClick={toggleLanguage}>
        {/* Show only the NEXT available language */}
        <span className="lang-label-target">{isRtl ? "EN" : "AR"}</span>

        <button className="onboarding-lang-btn" aria-label="Toggle language">
          🌐
        </button>
      </div>

      {/* ── Progress Indicators ── */}
      <div className="onboarding-steps" dir={isRtl ? "rtl" : "ltr"}>
        {[0, 1, 2].map((stepIndex) => (
          <span
            key={stepIndex}
            className={`onboarding-dot ${
              page === stepIndex ? "onboarding-dot--active" : ""
            } ${page > stepIndex ? "onboarding-dot--done" : ""}`}
          />
        ))}
      </div>

      {/* ── Content Area ── */}
      <div
        className={`onboarding-content ${isSliding ? "onboarding-content--sliding" : ""}`}
      >
        <div className="onboarding-title-block">
          <h1 className="onboarding-title">{current.title}</h1>
          <p className="onboarding-subtitle">{current.subtitle}</p>
        </div>
        <div className="onboarding-skeleton-wrapper">{current.skeleton}</div>
      </div>

      {/* ── Footer Actions ── */}
      <div className="onboarding-btn-area">
        <button className="onboarding-action-btn pulse" onClick={handleAction}>
          <span className="onboarding-btn-icon">{current.btnIcon}</span>
          {current.btnText}
        </button>
      </div>
    </div>
  );
}
