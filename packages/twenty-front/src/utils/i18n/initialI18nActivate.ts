import { fromNavigator, fromStorage, fromUrl } from '@lingui/detect-locale';
import {
  APP_LOCALES,
  isDefined,
  isValidLocale,
  SOURCE_LOCALE,
} from 'twenty-shared';
import { dynamicActivate } from '~/utils/i18n/dynamicActivate';

const resolveLocaleFromNavigator = (): keyof typeof APP_LOCALES | null => {
  const navigatorLocale = fromNavigator();
  if (!isDefined(navigatorLocale)) {
    return null;
  }
  if (isValidLocale(navigatorLocale)) {
    return navigatorLocale;
  }
  if (navigatorLocale.startsWith('en')) {
    return SOURCE_LOCALE;
  }
  const language = navigatorLocale.split('-')[0];
  if (!language) {
    return null;
  }
  const match = (Object.keys(APP_LOCALES) as (keyof typeof APP_LOCALES)[]).find(
    (key) => key === language || key.startsWith(`${language}-`),
  );
  return match && isValidLocale(match) ? match : null;
};

export const initialI18nActivate = () => {
  const urlLocale = fromUrl('locale');
  const storageLocale = fromStorage('locale');

  let locale: keyof typeof APP_LOCALES = APP_LOCALES.en;

  if (isDefined(urlLocale) && isValidLocale(urlLocale)) {
    locale = urlLocale;
    try {
      localStorage.setItem('locale', urlLocale);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log('Failed to save locale to localStorage:', error);
    }
  } else if (isDefined(storageLocale) && isValidLocale(storageLocale)) {
    locale = storageLocale;
  } else {
    const fromNav = resolveLocaleFromNavigator();
    if (fromNav) {
      locale = fromNav;
    }
  }

  dynamicActivate(locale);
};
