/**
 * Lightweight entry point for homepage search only.
 * Excludes OrgChartDiagram, OrgChartFilters, etc. which pull in twenty-ui's
 * CodeEditor → Monaco → TypeScript (Node-only, breaks in browser).
 */
export { CompanySearchAutocomplete } from './components/CompanySearchAutocomplete';
export type { CompanySearchAutocompleteProps } from './components/CompanySearchAutocomplete';
export {
    companySearchLightTheme, companySearchTheme as defaultTheme
} from './theme/companySearchTheme';

