import type { OrgChartThemeType } from './theme/companySearchTheme';

declare module '@emotion/react' {
  export interface Theme extends OrgChartThemeType {}
}
