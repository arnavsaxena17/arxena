import { readFileSync } from 'fs';

import {
  parseBuiltWithDetailedTechnologies,
  parseBuiltWithProfileCategories,
  parseBuiltWithProfileMeta,
} from './parse-builtwith-html.util';

describe('parseBuiltWithHtml', () => {
  const profileHtml = readFileSync(
    '/Users/arnavsaxena/Downloads/adani - builtwith.html',
    'utf8',
  );
  const detailedHtml = readFileSync(
    '/Users/arnavsaxena/Downloads/adani - detailed - builtwith.html',
    'utf8',
  );

  it('parses profile categories and meta from saved adani HTML', () => {
    const categories = parseBuiltWithProfileCategories(profileHtml);
    const meta = parseBuiltWithProfileMeta(profileHtml, detailedHtml);
    const technologyCount = categories.reduce(
      (sum, category) => sum + category.technologies.length,
      0,
    );

    expect(categories[0]?.category).toBe('Analytics and Tracking');
    expect(categories[0]?.technologies[0]?.name).toBe('Salesforce');
    expect(technologyCount).toBe(136);
    expect(meta.liveTechnologiesCount).toBe(136);
    expect(meta.topSiteRank).toBe(997787);
    expect(meta.aiIndex.score).toBe('43/100');
    expect(meta.technologySpend).toBe('$37,728+ / month');
  });

  it('parses detailed technology rows with historical flags', () => {
    const technologies = parseBuiltWithDetailedTechnologies(detailedHtml);
    const historicalCount = technologies.filter(
      (technology) => technology.isHistorical,
    ).length;

    expect(technologies.length).toBeGreaterThan(100);
    expect(historicalCount).toBeGreaterThan(20);
    expect(technologies[0]?.category).toBe('Analytics and Tracking');
    expect(technologies[0]?.name).toBe('Salesforce');
  });
});
