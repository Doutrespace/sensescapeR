/**
 * App language (English / German).
 *
 * English text is the key: `t('Start Recording')` returns the German
 * translation when German is active and the text itself otherwise, so a
 * missing translation falls back to readable English instead of a key name.
 * Placeholders use braces: `t('{count} recordings', { count: 3 })`.
 *
 * `t` reads a module-level language so it can be used anywhere, including
 * outside React. Screens pick up a language change because the root layout
 * remounts the navigation tree when the language changes.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { de } from './de';

export type Language = 'en' | 'de';

export const LANGUAGES: Array<{ code: Language; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
];

const STORAGE_KEY = 'soundscape.language';
const DICTIONARIES: Record<Language, Record<string, string> | null> = { en: null, de };

function detectDeviceLanguage(): Language {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    return locale.toLowerCase().startsWith('de') ? 'de' : 'en';
  } catch {
    return 'en';
  }
}

let currentLanguage: Language = detectDeviceLanguage();

/** German strings that were asked for but have no translation yet (dev aid). */
export const missingTranslations = new Set<string>();
if (__DEV__) {
  (globalThis as { __missingTranslations?: Set<string> }).__missingTranslations = missingTranslations;
}

export function getLanguage(): Language {
  return currentLanguage;
}

/** BCP 47 tag for date and number formatting. */
export function getLocaleTag(): string {
  return currentLanguage === 'de' ? 'de-DE' : 'en-US';
}

export function t(text: string, params?: Record<string, string | number>): string {
  const dictionary = DICTIONARIES[currentLanguage];
  let result = text;

  if (dictionary) {
    const translated = dictionary[text];
    if (translated !== undefined) {
      result = translated;
    } else if (__DEV__) {
      missingTranslations.add(text);
    }
  }

  if (!params) {
    return result;
  }

  return result.replace(/\{(\w+)\}/g, (placeholder, name: string) => (
    name in params ? String(params[name]) : placeholder
  ));
}

/**
 * Count-dependent text. Pass the singular and plural English sentences;
 * `{count}` is filled in automatically.
 */
export function tPlural(
  count: number,
  one: string,
  other: string,
  params?: Record<string, string | number>
): string {
  return t(count === 1 ? one : other, { count, ...params });
}

interface LanguageStoreState {
  language: Language;
  initialize: () => Promise<void>;
  setLanguage: (language: Language) => Promise<void>;
}

export const useLanguageStore = create<LanguageStoreState>((set) => ({
  language: currentLanguage,

  initialize: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === 'en' || stored === 'de') {
        currentLanguage = stored;
      }
    } catch {
      // Keep the detected device language.
    }
    set({ language: currentLanguage });
  },

  setLanguage: async (language) => {
    currentLanguage = language;
    set({ language });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, language);
    } catch {
      // The choice still applies for this session.
    }
  },
}));
