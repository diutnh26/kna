import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import vi from './locales/vi.json';

/**
 * i18n setup for the KNĂ prototype.
 *
 * Only two locales exist: "en" and "vi" — matching the "EN · VI" toggle
 * that's been sitting inert in Navbar.jsx. Detection order is: a locale the
 * visitor picked before (localStorage) → the browser's own language → "en".
 */
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      vi: { translation: vi },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'vi'],
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'kna-locale',
    },
    interpolation: { escapeValue: false },
  });

export default i18n;
