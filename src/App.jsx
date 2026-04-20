import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Preferences } from '@capacitor/preferences';
import { Capacitor, registerPlugin } from '@capacitor/core';
import './main.scss';

export const salahPhrases = [
  "اللهم صلِّ على نبيك محمد الذي تنحل به العقد وتنفرج به الكرب",
  "اللهم صلِّ على نبيك محمد الذي يستسقى الغمام بوجهه الكريم، وعلى آله وصحبه حق قدره ومقداره العظيم، وسلم سلاماً تاماً",
  "اللهم صل على سيدنا محمد وعلى آل سيدنا محمد كما صليت على إبراهيم وعلى آل إبراهيم إنك حميد مجيد",
  "اللهم بارك على سيدنا محمد وعلى آل سيدنا محمد كما باركت على إبراهيم وعلى آل إبراهيم إنك حميد مجيد",
  "اللهم صل على سيدنا محمد عبدك ورسولك ونبيك كما صليت على إبراهيم",
  "اللهم صل على سيدنا محمد النبي الأمي وعلى آل سيدنا محمد",
  "اللهم صل على سيدنا محمد وأزواجه وذريته كما صليت على آل إبراهيم",
  "اللهم صل على سيدنا محمد كلما ذكره الذاكرون",
  "اللهم صل على سيدنا محمد كلما غفل عن ذكره الغافلون",
  "اللهم صل وسلم وبارك على سيدنا سيدنا محمد وعلى آله وصحبه أجمعين",
  "اللهم صل على سيدنا محمد صلاة تنحل بها العقد وتنفرج بها الكرب",
  "اللهم صل على سيدنا محمد صلاة تقضي بها الحوائج وتنال بها الرغائب",
  "اللهم صل على سيدنا محمد صلاة تفتح لنا بها أبواب الخير والرزق والرحمة",
  "اللهم صل على سيدنا محمد صلاة تملأ خزائن الله نورا",
  "اللهم صل على سيدنا محمد صلاة تكون له رضا ولحقه أداء",
  "اللهم صل على سيدنا محمد وعلى آله وصحبه وسلم تسليما كثيرا",
  "اللهم صل على سيدنا محمد في الأولين",
  "اللهم صل على سيدنا محمد في الآخرين",
  "اللهم صل على سيدنا محمد في الملأ الأعلى إلى يوم الدين",
  "اللهم صل على سيدنا محمد في كل وقت وحين",
  "اللهم صل على سيدنا محمد النبي وأزواجه أمهات المؤمنين وذريته وأهل بيته",
  "اللهم صل على سيدنا محمد صلاة دائمة بدوام ملك الله",
  "اللهم صل على سيدنا محمد صلاة لا ينقطع مددها ولا يحصى عددها",
  "اللهم صل على سيدنا محمد صلاة تطهر بها قلوبنا من كل وصف يباعدنا عن مشاهدتك ومحبتك",
  "اللهم صل على سيدنا محمد صلاة تحسن بها الأخلاق وتيسر بها الأرزاق",
  "اللهم صل على سيدنا محمد صلاة تدفع بها عنا كل بلاء وسوء",
  "اللهم صل على سيدنا محمد صلاة تشرح بها صدورنا وتيسر بها أمورنا",
  "اللهم صل على سيدنا محمد عدد خلقك ورضا نفسك وزنة عرشك ومداد كلماتك",
  "اللهم صل على سيدنا محمد عدد ما أحاط به علمك وخط به قلمك وأحصاه كتابك",
  "اللهم صل على سيدنا محمد عدد كل قطرة قطرت من السموات إلى الأرض من يوم خلقت الدنيا إلى يوم القيامة",
  "اللهم صل على سيدنا محمد صلاة تكون لنا من جميع الأهوال والآفات منجية",
  "اللهم صل على سيدنا محمد صلاة ترفعنا بها عندك أعلى الدرجات",
  "اللهم صل على سيدنا محمد صلاة تبلغنا بها أقصى الغايات من جميع الخيرات",
  "اللهم صل على سيدنا محمد سيد المرسلين",
  "اللهم صل على سيدنا محمد خاتم النبيين",
  "اللهم صل على سيدنا محمد إمام المتقين",
  "اللهم صل على سيدنا محمد قائد الغر المحجلين",
  "اللهم صل على سيدنا محمد شفيع المذنبين",
  "اللهم صل على سيدنا محمد رحمة للعالمين",
  "اللهم صل على سيدنا محمد النور المبين",
  "اللهم صل على سيدنا محمد السراج المنير",
  "اللهم صل على سيدنا محمد صاحب الحوض المورود",
  "اللهم صل على سيدنا محمد صاحب الوسيلة والفضيلة والدرجة الرفيعة",
  "اللهم صل على سيدنا محمد وعلى آل سيدنا محمد الطيبين الطاهرين",
  "اللهم صل على سيدنا محمد صلاة تغفر بها ذنوبنا وتستر بها عيوبنا",
  "اللهم صل على سيدنا محمد صلاة تنير بها وجوهنا وتزكي بها نفوسنا",
  "اللهم صل على سيدنا محمد صلاة تبارك بها في أعمارنا وأعمالنا",
  "اللهم صل على سيدنا محمد صلاة تسعدنا بها في الدنيا والآخرة",
  "اللهم صل على سيدنا محمد ملء السموات وملء الأرض",
  "اللهم صل على سيدنا محمد ملء ما بينهما وملء ما شئت من شيء بعد",
  "اللهم صل على سيدنا محمد صلاة تليق بجلالك وعظمتك وجمالك",
  "اللهم صل على سيدنا محمد صلاة دائمة مستمرة لا تنقضي",
  "اللهم صل على سيدنا محمد صلاة تحشرنا بها تحت لوائه وتوردنا بها حوضه",
  "اللهم صل على سيدنا محمد صلاة تسقنا بها من يده الشريفة شربة لا نظمأ بعدها أبدا",
  "اللهم صل على سيدنا محمد وعلى آل سيدنا محمد كما تحب وترضى",
  "اللهم صل على سيدنا محمد عدد ما ذكره الذاكرون وعدد ما غفل عن ذكره الغافلون",
  "اللهم صل على سيدنا محمد عدد الأنفاس واللحظات",
  "اللهم صل على سيدنا محمد عدد السكون والحركات",
  "اللهم صل على سيدنا محمد عدد النجوم والرمال",
  "اللهم صل على سيدنا محمد عدد الأمطار والبحار",
  "اللهم صل على سيدنا محمد عدد أوراق الأشجار",
  "اللهم صل على سيدنا محمد عدد كل شيء في الكون",
  "اللهم صل على سيدنا محمد حبيبك ونبيك وصفيك",
  "اللهم صل على سيدنا محمد خير خلقك",
  "اللهم صل على سيدنا محمد صلاة تشفي بها المرضى وتعافي بها المبتلى",
  "اللهم صل على سيدنا محمد صلاة تفرج بها الهم وتكشف بها الغم",
  "اللهم صل على سيدنا محمد صلاة تسدد بها الديون وتيسر بها الشؤون",
  "اللهم صل على سيدنا محمد صلاة تصل بها قلوبنا بقلبه الشريف",
  "اللهم صل على سيدنا محمد صلاة تملأ قلوبنا حبا له وشوقا إليه",
  "اللهم صل على سيدنا محمد صلاة تجعلنا بها من المتمسكين بسنته",
  "اللهم صل على سيدنا محمد صلاة تجعلنا بها من المهتدين بهديه",
  "اللهم صل على سيدنا محمد صلاة تجعلنا بها من الفائزين بشفاعته",
  "اللهم صل على سيدنا محمد صلاة تجمعنا بها معه في الفردوس الأعلى",
  "اللهم صل على سيدنا محمد عبدك الذي اصطفيته للعالمين رحمة",
  "اللهم صل على سيدنا محمد نبيك الذي أرسلته بالحق بشيرا ونذيرا",
  "اللهم صل على سيدنا محمد الذي أخرجتنا به من الظلمات إلى النور",
  "اللهم صل على سيدنا محمد صلاة تفتح لنا بها أبواب الجنة",
  "اللهم صل على سيدنا محمد صلاة تغلق بها عنا أبواب النار",
  "اللهم صل على سيدنا محمد صلاة تبيض بها وجوهنا يوم تسود الوجوه",
  "اللهم صل على سيدنا محمد صلاة تثقل بها موازيننا",
  "اللهم صل على سيدنا محمد صلاة تثبت بها على الصراط أقدامنا",
  "اللهم صل على سيدنا محمد صلاة تملأ ميزاننا بالخيرات",
  "اللهم صل على سيدنا محمد صلاة لا حد لها ولا انتهاء",
  "اللهم صل على سيدنا محمد صلاة يرضاها هو وترضى بها عنا",
  "اللهم صل على سيدنا محمد صلاة تكون لنا نورا من بين أيدينا ومن خلفنا",
  "اللهم صل على سيدنا محمد صلاة تكون لنا نورا عن أيماننا وعن شمائلنا",
  "اللهم صل على سيدنا محمد صلاة تكون لنا نورا في قبورنا وفي حشرنا",
  "اللهم صل على سيدنا محمد عدد كل حرف في القرآن الكريم",
  "اللهم صل على سيدنا محمد عدد تسبيح الملائكة وحمد التوابين",
  "اللهم صل على سيدنا محمد صلاة لا يقدر قدرها إلا أنت",
  "اللهم صل على سيدنا محمد صلاة تحيط بجميع صلوات المصلين",
  "اللهم صل على سيدنا محمد صلاة تفوق جميع صلوات الذاكرين",
  "اللهم صل على سيدنا محمد النبي المصطفى والرسول المجتبى",
  "اللهم صل على سيدنا محمد صلاة تكون سببا في نيل شفاعته يوم القيامة",
  "اللهم صل على سيدنا محمد صلاة تكون سببا في مرافقتة في الجنة",
  "اللهم صل على سيدنا محمد وعلى آله وصحبه وسلم عدد كمال الله وكما يليق بكماله",
  "اللهم صل على سيدنا محمد صلاة لا يعلم كنهها إلا أنت",
  "اللهم صل على سيدنا محمد صلاة دائمة بدوامك باقية ببقائك",
  "اللهم صل على سيدنا محمد صلاة تصل إليه في قبره وتسر بها خاطره",
  "اللهم صل على سيدنا محمد صلاة ترد بها علينا السلام منه",
  "اللهم صل على سيدنا محمد صلاة تملأ الوجود بعبير ذكره",
  "اللهم صل على سيدنا محمد صلاة تعطر الأكوان بنور صلاتنا عليه"
];


// Register the custom Capacitor Plugin
const OverlayPlugin = registerPlugin('OverlayPlugin');

function App() {
  const { t, i18n } = useTranslation();
  const [hasPermission, setHasPermission] = useState(false);
  const [isTimerEnabled, setIsTimerEnabled] = useState(true);
  const [popupSpeed, setPopupSpeed] = useState('medium');

  const isRtl = i18n.language === 'ar';

  useEffect(() => {
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    checkPermission();
    Preferences.set({ key: 'salah_phrases', value: JSON.stringify(salahPhrases) });
  }, [i18n.language]);

  useEffect(() => {
    (async () => {
      const timerPref = await Preferences.get({ key: 'enable_active_timer' });
      if (timerPref.value !== null) {
        setIsTimerEnabled(timerPref.value === 'true');
      } else {
        await Preferences.set({ key: 'enable_active_timer', value: 'true' });
      }

      const speedPref = await Preferences.get({ key: 'popup_speed' });
      if (speedPref.value !== null) {
        setPopupSpeed(speedPref.value);
      } else {
        await Preferences.set({ key: 'popup_speed', value: 'medium' });
      }
    })();
  }, []);

  const changeLanguage = async (lng) => {
    await i18n.changeLanguage(lng);
    await Preferences.set({ key: 'user_lang', value: lng });
  };

  const toggleTimer = async () => {
    const newValue = !isTimerEnabled;
    setIsTimerEnabled(newValue);
    await Preferences.set({ key: 'enable_active_timer', value: newValue.toString() });
  };

  const changeSpeed = async (speed) => {
    setPopupSpeed(speed);
    await Preferences.set({ key: 'popup_speed', value: speed });
  };

  const checkPermission = async () => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
    try {
      const result = await OverlayPlugin.checkPermission();
      setHasPermission(result.granted);
    } catch (e) {
      console.error("Checking permission failed", e);
    }
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkPermission();
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const requestPermission = async () => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      alert("This feature is only available on Android native app.");
      return;
    }
    try {
      const result = await OverlayPlugin.requestPermission();
      setHasPermission(result.granted);
    } catch (e) {
      console.error("Requesting permission failed", e);
    }
  };



  return (
    <div className={`glass-container ${isRtl ? 'rtl' : 'ltr'}`}>
      <h1>{t('app_title')}</h1>
      <p className="description">{t('salah_desc')}</p>

      <div className={`settings-section ${isRtl ? 'rtl' : 'ltr'}`}>
        <span className="section-label">{t('settings')}</span>

        <div className="action-row">
          <div className="action-text">
            <h3 className="action-title">{t('language')}</h3>
          </div>
          <div className="lang-toggle">
            <button 
              className={`lang-btn ${i18n.language === 'ar' ? 'active' : ''}`}
              onClick={() => changeLanguage('ar')}
            >
              {t('arabic')}
            </button>
            <button 
              className={`lang-btn ${i18n.language === 'en' ? 'active' : ''}`}
              onClick={() => changeLanguage('en')}
            >
              {t('english')}
            </button>
          </div>
        </div>
        
        <div className="action-row" style={{ marginTop: '1rem' }}>
          <div className="action-text">
            <h3 className="action-title">{isRtl ? 'سرعة الإظهار' : 'Popup Speed'}</h3>
            <p className="action-desc">{isRtl ? 'تحديد مدة بقاء التذكير' : 'Select how long the popup stays visible'}</p>
          </div>
          <div className="dropdown-container">
            <select 
              value={popupSpeed} 
              onChange={(e) => changeSpeed(e.target.value)}
              className="speed-dropdown"
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(0,0,0,0.5)',
                color: 'white',
                fontSize: '1rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="slow">{isRtl ? 'بطيء' : 'Slow'}</option>
              <option value="medium">{isRtl ? 'متوسط' : 'Medium'}</option>
              <option value="fast">{isRtl ? 'سريع' : 'Fast'}</option>
            </select>
          </div>
        </div>

        <div className="action-row" style={{ marginTop: '1rem' }}>
          <div className="action-text">
            <h3 className="action-title">{isRtl ? 'مؤقت الاستخدام (ساعة)' : '1-Hour Active Timer'}</h3>
            <p className="action-desc">{isRtl ? 'إظهار التذكير كل ساعة أثناء الاستخدام' : 'Show popup every hour during active use'}</p>
          </div>
          <div className="lang-toggle">
            <button 
              className={`lang-btn ${isTimerEnabled ? 'active' : ''}`}
              onClick={toggleTimer}
            >
              {isTimerEnabled ? (isRtl ? 'مفعل' : 'ON') : (isRtl ? 'معطل' : 'OFF')}
            </button>
          </div>
        </div>
      </div>

    { !hasPermission  && (

   <div className={`settings-section ${isRtl ? 'rtl' : 'ltr'}`}>
        <span className="section-label">{t('permission')}</span>

        <div className="action-row">
          <div className="action-text">
            <h3 className="action-title">{t('draw_over_apps')}</h3>
            <p className="action-desc">{t('draw_over_apps_desc')}</p>
          </div>
        </div>
        
        <div className="action-row" style={{ marginTop: '1rem' }}>
          <button 
            onClick={requestPermission} 
            className="pulse"
            disabled={hasPermission}
          >
            {t('grant_permission')}
          </button>
        </div>
      </div>
     ) }
    </div>
  );
}

export default App;
