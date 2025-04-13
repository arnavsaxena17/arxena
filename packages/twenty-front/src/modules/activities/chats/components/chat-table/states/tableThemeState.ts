import { atomFamily } from 'recoil';

// Table theme state for each instance of the table
export const tableThemeState = atomFamily<string, string>({
  key: 'tableThemeState',
  default: 'ht-theme-main', // Default to light theme
}); 