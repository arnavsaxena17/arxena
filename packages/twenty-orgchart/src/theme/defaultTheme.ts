/**
 * Standalone theme - avoids importing twenty-ui which pulls in
 * CodeEditor/Monaco/TypeScript (Node-only, breaks in Next.js/SSR).
 */
import { companySearchTheme } from './companySearchTheme';

export const defaultTheme = companySearchTheme;
