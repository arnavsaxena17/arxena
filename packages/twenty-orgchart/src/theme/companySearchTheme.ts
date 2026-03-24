/**
 * Minimal theme for CompanySearchAutocomplete - avoids importing twenty-ui
 * which pulls in CodeEditor/Monaco/TypeScript (Node-only, breaks in browser).
 */

const baseTheme = {
  spacing: (...args: number[]) =>
    args.map((n) => `${n * 4}px`).join(' '),
  font: {
    size: { md: '14px', sm: '12px', xs: '11px', lg: '16px', xl: '20px' },
    family: 'Inter, system-ui, -apple-system, sans-serif',
    weight: { medium: '500' },
  },
  border: {
    radius: { sm: '6px', md: '8px', xl: '12px' },
  },
  boxShadow: {
    strong:
      '2px 4px 16px 0px rgba(0,0,0,0.16), 0px 2px 4px 0px rgba(0,0,0,0.08)',
  },
};

/** Dark theme for embedded/dark contexts */
export const companySearchTheme = {
  ...baseTheme,
  font: {
    ...baseTheme.font,
    color: {
      primary: '#ebebeb',
      secondary: '#b3b3b3',
      tertiary: '#818181',
    },
  },
  background: {
    primary: '#171717',
    secondary: '#1b1b1b',
    tertiary: '#1d1d1d',
    transparent: {
      light: 'rgba(0,0,0,0.06)',
      medium: 'rgba(0,0,0,0.1)',
    },
  },
  border: {
    ...baseTheme.border,
    color: { medium: '#292929', light: '#333333' },
  },
  color: { blue: '#1961ed' },
};

/** Theme type for Emotion - matches companySearchTheme shape */
export type OrgChartThemeType = typeof companySearchTheme;

/** Light theme for homepage / light backgrounds */
export const companySearchLightTheme = {
  ...baseTheme,
  font: {
    ...baseTheme.font,
    color: {
      primary: '#0a0a0a',
      secondary: '#525252',
      tertiary: '#737373',
    },
  },
  background: {
    primary: '#ffffff',
    secondary: '#fafafa',
    tertiary: '#f5f5f5',
    transparent: {
      light: 'rgba(0,0,0,0.04)',
      medium: 'rgba(0,0,0,0.08)',
    },
  },
  border: {
    ...baseTheme.border,
    color: { medium: '#e5e5e5', light: '#d4d4d4' },
  },
  color: { blue: '#1961ed' },
};
