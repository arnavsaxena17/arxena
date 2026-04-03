/** Parsed Google SERP organic row from Bright Data SERP API (format: json). */
export type BrightDataSerpOrganicEntry = {
  link?: string;
  title?: string;
  description?: string;
  global_rank?: number;
};

/** Typical top-level JSON from Bright Data when scraping Google with structured output. */
export type BrightDataSerpGoogleJson = {
  organic?: BrightDataSerpOrganicEntry[];
};
