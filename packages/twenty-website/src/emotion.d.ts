import '@emotion/react';

declare module '@emotion/react' {
  export interface Theme {
    spacing: (...args: number[]) => string;
    font: {
      size: { md: string; sm: string; xs: string };
      family: string;
      color: { primary: string; secondary: string; tertiary: string };
    };
    background: {
      primary: string;
      secondary: string;
      tertiary: string;
      transparent: { light: string; medium: string };
    };
    border: {
      radius: { sm: string; md: string; xl: string };
      color: { medium: string; light: string };
    };
    color: { blue: string };
    boxShadow?: { strong: string };
  }
}
