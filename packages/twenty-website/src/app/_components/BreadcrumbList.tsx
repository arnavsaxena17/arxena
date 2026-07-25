import Link from 'next/link';

type BreadcrumbItem = {
  name: string;
  url: string;
};

type BreadcrumbListProps = {
  items: BreadcrumbItem[];
  baseUrl: string;
};

export function BreadcrumbListSchema({ items, baseUrl }: BreadcrumbListProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${baseUrl}${item.url}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

type BreadcrumbNavProps = {
  items: BreadcrumbItem[];
};

export function BreadcrumbNav({ items }: BreadcrumbNavProps) {
  return (
    <nav aria-label="Breadcrumb" style={{ marginBottom: 24 }}>
      <ol
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 4,
          listStyle: 'none',
          padding: 0,
          margin: 0,
          fontSize: 14,
          color: '#818181',
        }}
      >
        {items.map((item, i) => (
          <li key={item.url} style={{ display: 'flex', alignItems: 'center' }}>
            {i > 0 && (
              <span style={{ margin: '0 6px', color: '#ccc' }} aria-hidden>
                ›
              </span>
            )}
            {i < items.length - 1 ? (
              <Link
                href={item.url}
                style={{ color: 'inherit', textDecoration: 'none' }}
              >
                {item.name}
              </Link>
            ) : (
              <span style={{ color: '#141414', fontWeight: 500 }}>
                {item.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
