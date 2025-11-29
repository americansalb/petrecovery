/**
 * Internationalization (i18n) System
 *
 * Provides translation support for multiple languages
 */

import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';

// Available locales
export const LOCALES = {
  en: { name: 'English', nativeName: 'English', flag: '🇺🇸' },
  es: { name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  fr: { name: 'French', nativeName: 'Français', flag: '🇫🇷' },
};

// Translation dictionaries
const translations = { en, es, fr };

// Default locale
export const DEFAULT_LOCALE = 'en';

/**
 * Get translation for a key
 */
export function t(key, locale = DEFAULT_LOCALE, params = {}) {
  const dict = translations[locale] || translations[DEFAULT_LOCALE];

  // Support nested keys like "common.save"
  const keys = key.split('.');
  let value = dict;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // Key not found, return key or fallback to English
      if (locale !== DEFAULT_LOCALE) {
        return t(key, DEFAULT_LOCALE, params);
      }
      return key;
    }
  }

  if (typeof value !== 'string') {
    return key;
  }

  // Replace parameters {{param}}
  return value.replace(/\{\{(\w+)\}\}/g, (match, param) => {
    return params[param] !== undefined ? params[param] : match;
  });
}

/**
 * Get all translations for a locale
 */
export function getTranslations(locale = DEFAULT_LOCALE) {
  return translations[locale] || translations[DEFAULT_LOCALE];
}

/**
 * Check if locale is supported
 */
export function isLocaleSupported(locale) {
  return locale in LOCALES;
}

/**
 * Get locale from request headers
 */
export function getLocaleFromHeaders(headers) {
  const acceptLanguage = headers.get('accept-language');
  if (!acceptLanguage) return DEFAULT_LOCALE;

  // Parse accept-language header
  const languages = acceptLanguage
    .split(',')
    .map(lang => {
      const [code, q = 'q=1.0'] = lang.trim().split(';');
      return {
        code: code.split('-')[0], // Get base language code
        quality: parseFloat(q.split('=')[1]) || 1,
      };
    })
    .sort((a, b) => b.quality - a.quality);

  // Find first supported language
  for (const { code } of languages) {
    if (isLocaleSupported(code)) {
      return code;
    }
  }

  return DEFAULT_LOCALE;
}

/**
 * Format date according to locale
 */
export function formatDate(date, locale = DEFAULT_LOCALE, options = {}) {
  const localeMap = {
    en: 'en-US',
    es: 'es-ES',
    fr: 'fr-FR',
  };

  return new Intl.DateTimeFormat(localeMap[locale] || 'en-US', {
    dateStyle: 'medium',
    ...options,
  }).format(new Date(date));
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date, locale = DEFAULT_LOCALE) {
  const localeMap = {
    en: 'en-US',
    es: 'es-ES',
    fr: 'fr-FR',
  };

  const rtf = new Intl.RelativeTimeFormat(localeMap[locale] || 'en-US', {
    numeric: 'auto',
  });

  const now = new Date();
  const then = new Date(date);
  const diffMs = then - now;
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);

  if (Math.abs(diffSec) < 60) {
    return rtf.format(diffSec, 'second');
  }
  if (Math.abs(diffMin) < 60) {
    return rtf.format(diffMin, 'minute');
  }
  if (Math.abs(diffHour) < 24) {
    return rtf.format(diffHour, 'hour');
  }
  if (Math.abs(diffDay) < 30) {
    return rtf.format(diffDay, 'day');
  }

  return formatDate(date, locale);
}

/**
 * Format number according to locale
 */
export function formatNumber(number, locale = DEFAULT_LOCALE, options = {}) {
  const localeMap = {
    en: 'en-US',
    es: 'es-ES',
    fr: 'fr-FR',
  };

  return new Intl.NumberFormat(localeMap[locale] || 'en-US', options).format(number);
}

/**
 * Format currency
 */
export function formatCurrency(amount, currency = 'USD', locale = DEFAULT_LOCALE) {
  return formatNumber(amount, locale, {
    style: 'currency',
    currency,
  });
}

/**
 * Format distance (miles to km for metric countries)
 */
export function formatDistance(miles, locale = DEFAULT_LOCALE) {
  const useMetric = ['es', 'fr'].includes(locale);

  if (useMetric) {
    const km = miles * 1.60934;
    return `${formatNumber(km, locale, { maximumFractionDigits: 1 })} km`;
  }

  return `${formatNumber(miles, locale, { maximumFractionDigits: 1 })} mi`;
}

/**
 * Get pluralized string
 */
export function pluralize(count, key, locale = DEFAULT_LOCALE) {
  const rules = new Intl.PluralRules(locale);
  const category = rules.select(count);

  // Try to get specific plural form
  const pluralKey = `${key}.${category}`;
  let result = t(pluralKey, locale);

  // Fallback to generic key with count
  if (result === pluralKey) {
    result = t(key, locale, { count });
  }

  return result.replace('{{count}}', count);
}

// React hook for client-side usage
export function useTranslation(locale = DEFAULT_LOCALE) {
  return {
    t: (key, params) => t(key, locale, params),
    formatDate: (date, options) => formatDate(date, locale, options),
    formatRelativeTime: (date) => formatRelativeTime(date, locale),
    formatNumber: (number, options) => formatNumber(number, locale, options),
    formatCurrency: (amount, currency) => formatCurrency(amount, currency, locale),
    formatDistance: (miles) => formatDistance(miles, locale),
    pluralize: (count, key) => pluralize(count, key, locale),
    locale,
    locales: LOCALES,
  };
}
