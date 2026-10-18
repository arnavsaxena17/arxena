import { config } from 'dotenv';
import { resolve } from 'path';

import { BrightDataSerpService } from 'src/engine/core-modules/bright-data/services/bright-data-serp.service';
import {
  buildCompanyNewsSearchQuery,
  mapBrightDataNewsToCompanyNewsResult,
} from 'src/engine/core-modules/org-chart/utils/map-bright-data-news-to-company-news.util';

config({ path: resolve(__dirname, '../../../../../../.env') });

const runLive = process.env.RUN_LIVE_COMPANY_NEWS === 'true';

(runLive ? describe : describe.skip)(
  'OrgChartCompanyNews Bright Data live',
  () => {
    const service = new BrightDataSerpService();

    it('fetches Google News for several companies via Fast SERP', async () => {
      expect(service.isGoogleNewsConfigured()).toBe(true);

      const companies = [
        { companyName: 'Stripe', location: 'San Francisco' },
        { companyName: 'Notion', location: 'San Francisco' },
        { companyName: 'Zoho', location: 'Chennai' },
        { companyName: 'Razorpay', location: 'Bangalore' },
      ];

      const summaries: Array<{
        company: string;
        query: string;
        ms: number;
        count: number;
        top: Array<{ date: string; summary: string; url: string }>;
        error?: string;
      }> = [];

      for (const company of companies) {
        const query = buildCompanyNewsSearchQuery(company);
        const started = Date.now();

        try {
          const serp = await service.requestGoogleNewsJson(query);
          const mapped = mapBrightDataNewsToCompanyNewsResult({
            ...company,
            serp,
          });

          summaries.push({
            company: company.companyName,
            query,
            ms: Date.now() - started,
            count: mapped.news_items.length,
            top: mapped.news_items.slice(0, 3).map((item) => ({
              date: item.date,
              summary: item.summary,
              url: item.url,
            })),
          });
        } catch (error) {
          summaries.push({
            company: company.companyName,
            query,
            ms: Date.now() - started,
            count: 0,
            top: [],
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const { writeFileSync } = await import('fs');
      const outPath = resolve(
        __dirname,
        '../../../../../../tmp-company-news-live.json',
      );
      writeFileSync(outPath, JSON.stringify(summaries, null, 2));

      const successes = summaries.filter((summary) => summary.count > 0);
      expect({
        outPath,
        successes: successes.length,
        summaries,
      }).toEqual(
        expect.objectContaining({
          successes: expect.any(Number),
        }),
      );
      expect(successes.length).toBeGreaterThanOrEqual(3);
    }, 120_000);
  },
);
