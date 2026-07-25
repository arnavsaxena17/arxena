/**
 * Re-export from twenty-orgchart company-search build.
 * Linaria class CSS + light theme tokens must load with the component
 * (Emotion ThemeProvider no longer styles this package).
 */
import '../../../twenty-orgchart/dist/twenty-orgchart.css';
import './company-search-theme.css';

export {
  CompanySearchAutocomplete,
  companySearchLightTheme,
  defaultTheme,
} from 'twenty-orgchart/company-search';
