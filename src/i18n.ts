import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { Preferences } from "@capacitor/preferences";

const resources = {
  ar: {
    translation: {
      "app_title": "صلِّ على سيدنا محمد ﷺ",
      "settings": "الإعدادات",
      "language": "اللغة",
      "arabic": "العربية",
      "english": "English",
      "salah_reminder": "اللهم صل وسلم على نبينا محمد",
      "draw_over_apps": "تفعيل النافذة",
      "draw_over_apps_desc": "يرجى تفعيل هذا الإذن لكي يتم إظهار التذكير عند فتح قفل الشاشة",
      "grant_permission": "منح الإذن",
      "permission_granted": "الإذن مفعل",
      "salah_desc": "تطبيق لتذكيرك بالصلاة على سيدنا محمد ﷺ \nفي كل مرة تفتح فيها هاتفك.",
      "preview": "معاينة التذكير",
      "check_permission": "التحقق من الإذن",
      "permission": "الإذن"
    }
  },
  en: {
    translation: {
      "app_title": "Prophet Salah Reminder",
      "settings": "Settings",
      "language": "Language",
      "arabic": "العربية",
      "english": "English",
      "salah_reminder": "Peace be upon Prophet Muhammad",
      "draw_over_apps": "Enable Unlock Popup",
      "draw_over_apps_desc": "Please enable Draw Over Apps permission for the reminder popup upon unlocking your screen.",
      "grant_permission": "Grant Permission",
      "permission_granted": "Permission Granted",
      "salah_desc": "An app to remind you to send blessings upon Prophet Muhammad ﷺ every time you unlock your device.",
      "preview": "Preview Reminder",
      "check_permission": "Check Permission",
      "permission": "Permission"
    }
  }
};

// ── Read language synchronously from localStorage (instant, no async wait) ──
const savedLang = localStorage.getItem('user_lang') ?? 'ar';

// ── Initialize immediately and synchronously — no flash ──
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLang,
    fallbackLng: 'ar',
    interpolation: { escapeValue: false },
  });

// ── Sync: if native side wrote a different lang to Preferences, apply it ──
export const syncLangToPreferences = async () => {
  const { value } = await Preferences.get({ key: 'user_lang' });
  if (value && value !== savedLang) {
    localStorage.setItem('user_lang', value);
    await i18n.changeLanguage(value);
  }
};

// ── Called from main.tsx — runs sync after mount ──
export const initI18n = async () => {
  await syncLangToPreferences();
};

export default i18n;