import { type Locale } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { type APP_LOCALES } from 'twenty-shared/i18n';
import { createState } from 'twenty-ui';

type DateLocaleState = {
  locale?: keyof typeof APP_LOCALES;
  localeCatalog: Locale;
};

export const dateLocaleState = createState<DateLocaleState>({
  key: 'dateLocaleState',
  defaultValue: {
    locale: undefined,
    localeCatalog: enUS,
  },
});
