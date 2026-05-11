import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";

// ─── Types ────────────────────────────────────────────────────────────────────
interface OnboardingFlowProps {
  initialStep: 0 | 1;
  hasPermission: boolean | null;
  isBatteryOptimized: boolean | null;
  checkPermission: () => Promise<void>;
  requestPermission: () => Promise<void>;
  requestBatteryPermission: () => Promise<void>;
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
  initialStep,
  hasPermission,
  isBatteryOptimized,
  checkPermission,
  requestPermission,
  requestBatteryPermission,
  changeLanguage,
}: OnboardingFlowProps) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  const [page, setPage] = useState<0 | 1>(() => initialStep);
  const [isSliding, setIsSliding] = useState(false);

  // ── Animation Helper ─────────────────────────────────────────────────────
  const slideToStepTwo = useCallback(() => {
    if (isSliding || page === 1) return;
    setIsSliding(true);
    setTimeout(() => {
      setPage(1);
      setIsSliding(false);
    }, 400);
  }, [isSliding, page]);

  // ── Step 1 Gatekeeper: Advance only when overlay is granted ──────────────
  const prevHasPermission = useRef(hasPermission);
  useEffect(() => {
    if (
      page === 0 &&
      hasPermission === true &&
      prevHasPermission.current !== true
    ) {
      slideToStepTwo();
    }
    prevHasPermission.current = hasPermission;
  }, [hasPermission, page, slideToStepTwo]);

  // ── Permission Re-check on App Foreground ────────────────────────────────
  const pageRef = useRef(page);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  const handleVisibilityChange = useCallback(async () => {
    if (document.visibilityState === "visible") {
      await checkPermission();
    }
  }, [checkPermission]);

  useEffect(() => {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [handleVisibilityChange]);

  const toggleLanguage = async () => {
    await changeLanguage(i18n.language === "ar" ? "en" : "ar");
  };

  const handleAction = async () => {
    if (page === 0) {
      await requestPermission();
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
      className={`onboarding-screen ${isRtl ? "rtl" : "ltr"}`}
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
      <div className="onboarding-steps" dir="ltr">
        {[0, 1].map((stepIndex) => (
          <span
            key={stepIndex}
            /* Logic fix: use the full '--active' and '--done' names */
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
        {/* <p className="onboarding-step-label">
          {isRtl ? `الخطوة ${page + 1} من 2` : `Step ${page + 1} of 2`}
        </p> */}
      </div>
    </div>
  );
}
