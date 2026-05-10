import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";

// ─── Types ────────────────────────────────────────────────────────────────────
interface OnboardingFlowProps {
  /** Which step to START on — derived from live permission check in App.tsx */
  initialStep: 0 | 1;
  /** Live overlay permission state (from App.tsx) */
  hasPermission: boolean | null;
  /** Live battery optimization state (from App.tsx) */
  isBatteryOptimized: boolean | null;
  /** Re-runs both permission checks and updates App.tsx state */
  checkPermission: () => Promise<void>;
  requestPermission: () => Promise<void>;
  requestBatteryPermission: () => Promise<void>;
  changeLanguage: (lng: string) => Promise<void>;
}

// ─── Skeleton: Overlay (Draw Over Apps) ──────────────────────────────────────
function OverlaySkeleton({ isRtl }: { isRtl: boolean }) {
  const appLabel = isRtl ? "صلِّ على محمد" : "Salo App";

  return (
    <div className="skeleton-screen" dir={isRtl ? "rtl" : "ltr"}>
      {/* Fake page header */}
      <div className="skeleton-header-bar">
        <div className="skeleton-bar skeleton-bar--short" />
      </div>

      {/* Generic filler rows */}
      <div className="skeleton-row">
        <div className="skeleton-bar skeleton-bar--icon" />
        <div className="skeleton-text-group">
          <div className="skeleton-bar skeleton-bar--medium" />
          <div className="skeleton-bar skeleton-bar--thin" />
        </div>
        <div className="skeleton-switch">
          <span className="skeleton-switch-thumb" />
        </div>
      </div>

      <div className="skeleton-row">
        <div className="skeleton-bar skeleton-bar--icon" />
        <div className="skeleton-text-group">
          <div className="skeleton-bar skeleton-bar--long" />
          <div className="skeleton-bar skeleton-bar--thin" />
        </div>
        <div className="skeleton-switch">
          <span className="skeleton-switch-thumb" />
        </div>
      </div>

      {/* ★ Highlighted "Salo App" row — switch animated ON */}
      <div className="skeleton-row skeleton-row--highlight">
        <div className="skeleton-bar skeleton-bar--icon skeleton-bar--app-icon" />
        <div className="skeleton-text-group">
          <span className="skeleton-app-label">{appLabel}</span>
          <div className="skeleton-bar skeleton-bar--thin" style={{ width: "55%" }} />
        </div>
        <div className="skeleton-switch skeleton-switch--on">
          <span className="skeleton-switch-thumb skeleton-switch-thumb--on" />
        </div>
        {/* Hand pointer animates toward the switch */}
        <div className="hand-pointer hand-pointer--overlay" aria-hidden="true">👆</div>
      </div>

      {/* More filler */}
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
  const appLabel = isRtl ? "صلِّ على محمد" : "Salo App";
  const unrestricted = isRtl ? "بلا قيود" : "Unrestricted";
  const optimized = isRtl ? "محسَّن" : "Optimized";
  const restricted = isRtl ? "مقيَّد" : "Restricted";

  return (
    <div className="skeleton-screen" dir={isRtl ? "rtl" : "ltr"}>
      {/* Fake header */}
      <div className="skeleton-header-bar">
        <div className="skeleton-bar skeleton-bar--short" />
      </div>

      {/* App identity row */}
      <div className="skeleton-row">
        <div className="skeleton-bar skeleton-bar--icon skeleton-bar--app-icon" />
        <div className="skeleton-text-group">
          <span className="skeleton-app-label">{appLabel}</span>
          <div className="skeleton-bar skeleton-bar--thin" style={{ width: "45%" }} />
        </div>
      </div>

      <div className="skeleton-divider" />

      {/* ★ "Unrestricted" selected — hand taps it */}
      <div className="skeleton-radio-row skeleton-radio-row--highlight" style={{ position: "relative" }}>
        <div className="skeleton-radio skeleton-radio--selected" />
        <span className="skeleton-app-label">{unrestricted}</span>
        <div className="hand-pointer hand-pointer--battery" aria-hidden="true">👆</div>
      </div>

      <div className="skeleton-radio-row">
        <div className="skeleton-radio" />
        <div className="skeleton-text-group">
          <div className="skeleton-bar skeleton-bar--medium" style={{ marginBottom: 4 }} />
          <span className="skeleton-radio-label">{optimized}</span>
        </div>
      </div>

      <div className="skeleton-radio-row">
        <div className="skeleton-radio" />
        <div className="skeleton-text-group">
          <div className="skeleton-bar skeleton-bar--medium" style={{ marginBottom: 4 }} />
          <span className="skeleton-radio-label">{restricted}</span>
        </div>
      </div>
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

  // ── Strict state machine ─────────────────────────────────────────────────
  // page is initialized ONCE from the live-verified initialStep.
  // It can only increase (0 → 1), never decrease.
  const [page, setPage] = useState<0 | 1>(() => initialStep);
  const [isSliding, setIsSliding] = useState(false);

  // ── Debug mode ────────────────────────────────────────────────────────────
  const [showDebug, setShowDebug] = useState(false);

  // Always log permission states for debugging
  useEffect(() => {
    console.log(
      `[Onboarding] page=${page} | overlay=${hasPermission} | battery_ignored=${isBatteryOptimized}`
    );
  }, [page, hasPermission, isBatteryOptimized]);

  // ── Slide helper (one-way, forward only) ─────────────────────────────────
  const slideTo1 = useCallback(() => {
    if (isSliding || page === 1) return;
    console.log("[Onboarding] Overlay VERIFIED ✓ — sliding to Step 2 (Battery)");
    setIsSliding(true);
    setTimeout(() => {
      setPage(1);
      setIsSliding(false);
    }, 400);
  }, [isSliding, page]);

  // ── GATEKEEPER: Only advance to Step 2 when overlay is physically true ───
  // Uses a ref to track the previous value so we only react to fresh changes.
  const prevHasPermission = useRef(hasPermission);
  useEffect(() => {
    // Guard: we're on Step 1 (overlay) and the value JUST turned true
    if (page === 0 && hasPermission === true && prevHasPermission.current !== true) {
      console.log("[Onboarding] Overlay changed → true. Gatekeeper allows Step 2.");
      slideTo1();
    }
    prevHasPermission.current = hasPermission;
  }, [hasPermission, page, slideTo1]);

  // ── Step 2 completion: App.tsx auto-routes when battery becomes ignored ──
  // (when isBatteryOptimized === true the condition in App.tsx becomes false
  //  and the dashboard renders automatically — no explicit onComplete needed)
  useEffect(() => {
    if (page === 1 && isBatteryOptimized === true) {
      console.log("[Onboarding] Battery VERIFIED ✓ — routing to dashboard.");
    }
  }, [isBatteryOptimized, page]);

  // ── visibilitychange: re-run the appropriate permission check ─────────────
  // Uses `page` from a ref so the stale-closure trap is avoided.
  const pageRef = useRef(page);
  useEffect(() => { pageRef.current = page; }, [page]);

  const handleVisibilityChange = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    console.log(
      `[Onboarding] App foregrounded — re-checking permissions (page=${pageRef.current})…`
    );
    await checkPermission();
  }, [checkPermission]);

  useEffect(() => {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [handleVisibilityChange]);

  // ── Language toggle ───────────────────────────────────────────────────────
  const toggleLanguage = async () => {
    const next = i18n.language === "ar" ? "en" : "ar";
    await changeLanguage(next);
  };

  // ── Action button handler ─────────────────────────────────────────────────
  const handleAction = async () => {
    if (page === 0) {
      console.log("[Onboarding] User tapping 'Grant Overlay' — opening system settings…");
      await requestPermission();
    } else {
      console.log("[Onboarding] User tapping 'Battery Settings' — opening system settings…");
      await requestBatteryPermission();
    }
  };

  // ── Page content lookup ───────────────────────────────────────────────────
  const pages = [
    {
      key: "overlay",
      titleAr: "تفعيل النافذة",
      titleEn: "Enable Overlay",
      subtitleAr: "حتى يظهر التذكير على الشاشة يجب تفعيل إذن \"العرض فوق التطبيقات\". افتح الإعدادات ثم ابحث عن اسم التطبيق صلِّ على محمد ﷺ ثم قم بتفعيل الإذن.",
      subtitleEn: "To show reminders on the screen, you must enable the 'Display over other apps' permission. Open Settings, search for 'SaliAla Mohamed', and then enable the permission.",
      skeleton: <OverlaySkeleton isRtl={isRtl} />,
      btnAr: "منح الإذن",
      btnEn: "Grant Permission",
      btnIcon: "🔓",
    },
    {
      key: "battery",
      titleAr: "تحسين البطارية",
      titleEn: "Battery Optimization",
      subtitleAr: "لضمان عمل التذكير في الخلفية دائماً، اختر \"بلا قيود\" من إعدادات بطارية التطبيق.",
      subtitleEn: "To ensure the reminder always works in the background, select \"Unrestricted\" in the app's battery settings.",
      skeleton: <BatterySkeleton isRtl={isRtl} />,
      btnAr: "ضبط إعدادات البطارية",
      btnEn: "Adjust Battery Settings",
      btnIcon: "🔋",
    },
  ] as const;

  const current = pages[page];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className={`onboarding-screen ${isRtl ? "rtl" : "ltr"}`}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* ── Global 🌐 language toggle — fixed top right ── */}
      <button
        className="onboarding-lang-btn"
        onClick={toggleLanguage}
        title={isRtl ? "Switch to English" : "التبديل إلى العربية"}
        aria-label="Toggle language"
      >
        🌐
      </button>

      {/* ── Debug panel (tap 🌐 5× to reveal) — hidden in production ── */}
      <button
        className="onboarding-debug-trigger"
        onClick={() => setShowDebug(v => !v)}
        aria-label="Toggle debug"
      />
      {showDebug && (
        <div className="onboarding-debug-panel">
          <strong>Debug</strong>
          <div>overlay: <span style={{ color: hasPermission ? "#4ade80" : "#f87171" }}>{String(hasPermission)}</span></div>
          <div>battery_ignored: <span style={{ color: isBatteryOptimized ? "#4ade80" : "#f87171" }}>{String(isBatteryOptimized)}</span></div>
          <div>page: {page} | initialStep: {initialStep}</div>
        </div>
      )}

      {/* ── Step dots ── */}
      <div className="onboarding-steps">
        <span className={`onboarding-dot ${page === 0 ? "onboarding-dot--active" : "onboarding-dot--done"}`} />
        <span className={`onboarding-dot ${page === 1 ? "onboarding-dot--active" : ""}`} />
      </div>

      {/* ── Sliding content area ── */}
      <div className={`onboarding-content ${isSliding ? "onboarding-content--sliding" : ""}`}>
        <div className="onboarding-title-block">
          <h1 className="onboarding-title">
            {isRtl ? current.titleAr : current.titleEn}
          </h1>
          <p className="onboarding-subtitle">
            {isRtl ? current.subtitleAr : current.subtitleEn}
          </p>
        </div>

        <div className="onboarding-skeleton-wrapper">
          {current.skeleton}
        </div>
      </div>

      {/* ── Gold action button — always visible at bottom ── */}
      <div className="onboarding-btn-area">
        <button
          className="onboarding-action-btn pulse"
          onClick={handleAction}
        >
          <span className="onboarding-btn-icon">{current.btnIcon}</span>
          {isRtl ? current.btnAr : current.btnEn}
        </button>
        <p className="onboarding-step-label">
          {isRtl ? `الخطوة ${page + 1} من 2` : `Step ${page + 1} of 2`}
        </p>
      </div>
    </div>
  );
}
