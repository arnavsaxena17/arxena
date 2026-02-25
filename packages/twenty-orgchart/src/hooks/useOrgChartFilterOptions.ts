import { useMemo } from 'react';

export const useOrgChartFilterOptions = (
  orgData: Record<string, unknown> | null,
) => {
  const availableCountries = useMemo(() => {
    if (!orgData) return [];

    const rawCountries = (orgData as Record<string, unknown>).countries;

    if (typeof rawCountries === 'string') {
      try {
        const parsed = JSON.parse(rawCountries) as unknown;
        if (Array.isArray(parsed)) {
          const cleaned = parsed
            .filter((c): c is string => typeof c === 'string')
            .filter((c) => c !== '0');
          const withGlobal = [...cleaned, 'global'];
          return Array.from(new Set(withGlobal)).sort((a, b) =>
            a.localeCompare(b),
          );
        }
      } catch {
        return [];
      }
    }

    if (Array.isArray(rawCountries)) {
      const cleaned = rawCountries
        .filter((c): c is string => typeof c === 'string')
        .filter((c) => c !== '0');
      const withGlobal = [...cleaned, 'global'];
      return Array.from(new Set(withGlobal)).sort((a, b) =>
        a.localeCompare(b),
      );
    }

    return [];
  }, [orgData]);

  const availableFunctionRoots = useMemo(() => {
    if (!orgData) return [];

    const rawFunctions = (orgData as Record<string, unknown>).functions;

    if (typeof rawFunctions === 'string') {
      try {
        const parsed = JSON.parse(rawFunctions) as unknown;
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(
            (fn): fn is string =>
              typeof fn === 'string' && fn.trim().length > 0,
          );
          return Array.from(new Set(cleaned)).sort((a, b) =>
            a.localeCompare(b),
          );
        }
      } catch {
        return [];
      }
    }

    if (Array.isArray(rawFunctions)) {
      const cleaned = rawFunctions.filter(
        (fn): fn is string =>
          typeof fn === 'string' && fn.trim().length > 0,
      );
      return Array.from(new Set(cleaned)).sort((a, b) => a.localeCompare(b));
    }

    return [];
  }, [orgData]);

  const countryPercentLabels = useMemo(() => {
    if (!orgData) return {};

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

    if (!analytics) return labels;

    const globalTotal =
      typeof analytics.global === 'number' && analytics.global > 0
        ? analytics.global
        : null;
    const total = globalTotal ?? null;

    if (!total) return labels;

    Object.entries(analytics).forEach(([country, count]) => {
      if (typeof count !== 'number' || count <= 0) return;
      const percent = (count / total) * 100;
      labels[country] = `${percent.toFixed(1)}%`;
    });

    return labels;
  }, [orgData]);

  const functionRootPercentLabels = useMemo(() => {
    if (!orgData) return {};

    const labels: Record<string, string> = {};
    const orgchartStr = (orgData as Record<string, unknown>).orgchart;

    if (typeof orgchartStr !== 'string') return labels;

    try {
      const rawNodes = JSON.parse(orgchartStr) as Array<{
        std_function_root?: string;
        len_candidates?: number;
      }>;

      if (!Array.isArray(rawNodes)) return labels;

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
      if (!total) return labels;

      counts.fullcompany = total;

      Object.entries(counts).forEach(([root, count]) => {
        if (count <= 0) return;
        const percent = (count / total) * 100;
        labels[root] = `${percent.toFixed(1)}%`;
      });

      return labels;
    } catch {
      return labels;
    }
  }, [orgData]);

  return {
    availableCountries,
    availableFunctionRoots,
    countryPercentLabels,
    functionRootPercentLabels,
  };
};
