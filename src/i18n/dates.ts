import { format } from 'date-fns';
import { de as germanLocale } from 'date-fns/locale/de';
import { getLanguage } from './index';

type DateStyle = 'short' | 'long' | 'month' | 'time';

const PATTERNS: Record<'en' | 'de', Record<DateStyle, string>> = {
  en: {
    short: 'MMM d, yyyy',
    long: 'EEEE, MMMM d, yyyy',
    month: 'MMMM d, yyyy',
    time: 'h:mm a',
  },
  de: {
    short: 'd. MMM yyyy',
    long: 'EEEE, d. MMMM yyyy',
    month: 'd. MMMM yyyy',
    time: 'HH:mm',
  },
};

/** Formats a date the way the active app language writes it. */
export function formatDate(date: Date, style: DateStyle): string {
  const language = getLanguage();
  return format(date, PATTERNS[language][style], language === 'de' ? { locale: germanLocale } : undefined);
}
