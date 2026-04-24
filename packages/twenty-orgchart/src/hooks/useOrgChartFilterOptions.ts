import { useMemo } from 'react';

import {
    sortOrgChartCountryKeys,
    sortOrgChartFunctionRootKeys,
} from '../utils/orgChartFilterDropdownSort';

export const useOrgChartFilterOptions = (
  orgData: Record<string, unknown> | null,
) => {
  const { availableCountries, countryPercentLabels } = useMemo(() => {
    if (!orgData) {
      return { availableCountries: [] as string[], countryPercentLabels: {} };
    }

    const rawCountries = (orgData as Record<string, unknown>).countries;
    let cleaned: string[] = [];

    if (typeof rawCountries === 'string') {
      try {
        const parsed = JSON.parse(rawCountries) as unknown;
        if (Array.isArray(parsed)) {
          cleaned = parsed
            .filter((c): c is string => typeof c === 'string')
            .filter((c) => c !== '0');
        }
      } catch {
        return { availableCountries: [], countryPercentLabels: {} };
      }
    } else if (Array.isArray(rawCountries)) {
      cleaned = rawCountries
        .filter((c): c is string => typeof c === 'string')
        .filter((c) => c !== '0');
    }

    const labels: Record<string, string> = {};
    const analyticsRaw = (orgData as Record<string, unknown>).country_analytics;

    let analytics: Record<string, number> | null = null;

    if (typeof analyticsRaw === 'string') {
      try {
        const parsed = JSON.parse(analyticsRaw) as unknown;
        if (
          parsed &&
          typeof parsed === 'object' &&
          !Array.isArray(parsed)
        ) {
          analytics = Object.entries(parsed as Record<string, unknown>).reduce<
            Record<string, number>
          >((acc, [key, value]) => {
            if (typeof value === 'number') {
              acc[key] = value;
            }
            return acc;
          }, {});
        }
      } catch {
        analytics = null;
      }
    } else if (
      analyticsRaw &&
      typeof analyticsRaw === 'object' &&
      !Array.isArray(analyticsRaw)
    ) {
      analytics = Object.entries(
        analyticsRaw as Record<string, unknown>,
      ).reduce<Record<string, number>>((acc, [key, value]) => {
        if (typeof value === 'number') {
          acc[key] = value;
        }
        return acc;
      }, {});
    }

    if (analytics) {
      const globalTotal =
        typeof analytics.global === 'number' && analytics.global > 0
          ? analytics.global
          : null;
      const total = globalTotal ?? null;

      if (total) {
        Object.entries(analytics).forEach(([country, count]) => {
          if (typeof count !== 'number' || count <= 0) return;
          const percent = (count / total) * 100;
          labels[country] = `${percent.toFixed(1)}%`;
        });
      }
    }

    const withGlobal = [...cleaned, 'global'];
    const availableCountries = sortOrgChartCountryKeys(withGlobal, labels);

    return { availableCountries, countryPercentLabels: labels };
  }, [orgData]);

  const { availableFunctionRoots, functionRootPercentLabels } = useMemo(() => {
    if (!orgData) {
      return {
        availableFunctionRoots: [] as string[],
        functionRootPercentLabels: {},
      };
    }

    const rawFunctions = (orgData as Record<string, unknown>).functions;
    const isValidFunctionRoot = (fn: unknown): fn is string =>
      typeof fn === 'string' &&
      fn.trim().length > 0 &&
      !fn.toLowerCase().includes('assist');

    let cleaned: string[] = [];

    if (typeof rawFunctions === 'string') {
      try {
        const parsed = JSON.parse(rawFunctions) as unknown;
        if (Array.isArray(parsed)) {
          cleaned = parsed.filter(isValidFunctionRoot);
        } else {
          return {
            availableFunctionRoots: [],
            functionRootPercentLabels: {},
          };
        }
      } catch {
        return {
          availableFunctionRoots: [],
          functionRootPercentLabels: {},
        };
      }
    } else if (Array.isArray(rawFunctions)) {
      cleaned = rawFunctions.filter(isValidFunctionRoot);
    }

    const labels: Record<string, string> = {};
    const orgchartRaw = (orgData as Record<string, unknown>).orgchart;

    let rawNodes: Array<{
      std_function_root?: string;
      len_candidates?: number;
    }>;

    if (Array.isArray(orgchartRaw)) {
      rawNodes = orgchartRaw as Array<{
        std_function_root?: string;
        len_candidates?: number;
      }>;
    } else if (typeof orgchartRaw === 'string') {
      try {
        const parsed = JSON.parse(orgchartRaw) as unknown;
        if (!Array.isArray(parsed)) {
          const withFullCompany = sortOrgChartFunctionRootKeys(
            [...cleaned, 'fullcompany'],
            labels,
          );
          return {
            availableFunctionRoots: withFullCompany,
            functionRootPercentLabels: labels,
          };
        }
        rawNodes = parsed;
      } catch {
        const withFullCompany = sortOrgChartFunctionRootKeys(
          [...cleaned, 'fullcompany'],
          labels,
        );
        return {
          availableFunctionRoots: withFullCompany,
          functionRootPercentLabels: labels,
        };
      }
    } else {
      const withFullCompany = sortOrgChartFunctionRootKeys(
        [...cleaned, 'fullcompany'],
        labels,
      );
      return {
        availableFunctionRoots: withFullCompany,
        functionRootPercentLabels: labels,
      };
    }

    try {
      const counts: Record<string, number> = {};

      rawNodes.forEach((node) => {
        const root =
          typeof node.std_function_root === 'string'
            ? node.std_function_root
            : undefined;
        const len =
          typeof node.len_candidates === 'number' ? node.len_candidates : 0;

        if (!root || len <= 0) return;
        counts[root] = (counts[root] ?? 0) + len;
      });

      const total = Object.values(counts).reduce(
        (sum, value) => sum + value,
        0,
      );
      if (!total) {
        const withFullCompany = sortOrgChartFunctionRootKeys(
          [...cleaned, 'fullcompany'],
          labels,
        );
        return {
          availableFunctionRoots: withFullCompany,
          functionRootPercentLabels: labels,
        };
      }

      counts.fullcompany = total;

      Object.entries(counts).forEach(([root, count]) => {
        if (count <= 0) return;
        const percent = (count / total) * 100;
        labels[root] = `${percent.toFixed(1)}%`;
      });

      const withFullCompany = sortOrgChartFunctionRootKeys(
        [...cleaned, 'fullcompany'],
        labels,
      );

      return {
        availableFunctionRoots: withFullCompany,
        functionRootPercentLabels: labels,
      };
    } catch {
      const withFullCompany = sortOrgChartFunctionRootKeys(
        [...cleaned, 'fullcompany'],
        labels,
      );
      return {
        availableFunctionRoots: withFullCompany,
        functionRootPercentLabels: labels,
      };
    }
  }, [orgData]);

  return {
    availableCountries,
    availableFunctionRoots,
    countryPercentLabels,
    functionRootPercentLabels,
  };
};
