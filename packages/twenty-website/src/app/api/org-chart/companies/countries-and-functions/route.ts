import { NextResponse } from 'next/server';

import { toSlug } from 'twenty-shared';

export const dynamic = 'force-dynamic';

const getServerBaseUrl = () => {
  const url =
    process.env.SERVER_BASE_URL ??
    process.env.NEXT_PUBLIC_SERVER_BASE_URL ??
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '');
  return url.replace(/\/$/, '');
};

type Slice = { country: string; type: string; docCount: number };

export async function GET() {
  const serverBaseUrl = getServerBaseUrl();
  if (!serverBaseUrl) {
    return NextResponse.json(
      { countries: [], functions: [], status: 'ok' },
      { status: 200 },
    );
  }

  try {
    const response = await fetch(
      `${serverBaseUrl}/org-chart/companies/sitemap-slices`,
    );
    const data = (await response.json()) as { slices?: Slice[] };
    const slices = data.slices ?? [];

    const countryMap = new Map<string, number>();
    const functionMap = new Map<
      string,
      { country: string; docCount: number }
    >();

    for (const { country, type, docCount } of slices) {
      if (country === 'global') continue;
      if (type === 'fullcompany') {
        countryMap.set(country, (countryMap.get(country) ?? 0) + docCount);
      } else {
        const existing = functionMap.get(type);
        if (!existing || docCount > existing.docCount) {
          functionMap.set(type, { country, docCount });
        }
      }
    }

    const countries = Array.from(countryMap.entries())
      .map(([country, docCount]) => ({
        country,
        countrySlug: toSlug(country),
        docCount,
      }))
      .sort((a, b) => b.docCount - a.docCount);

    const functions = Array.from(functionMap.entries())
      .map(([type, { country, docCount }]) => ({
        type,
        typeSlug: toSlug(type),
        topCountry: country,
        topCountrySlug: toSlug(country),
        docCount,
      }))
      .sort((a, b) => b.docCount - a.docCount);

    return NextResponse.json({
      countries,
      functions,
      status: 'ok',
    });
  } catch {
    return NextResponse.json(
      { countries: [], functions: [], status: 'ok' },
      { status: 200 },
    );
  }
}
