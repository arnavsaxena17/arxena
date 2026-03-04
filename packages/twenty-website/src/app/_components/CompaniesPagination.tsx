import Link from 'next/link';

type CompaniesPaginationProps = {
  currentPage: number;
  hasMore: boolean;
  basePath: string;
  letterMode?: boolean;
};

function pageHref(
  basePath: string,
  page: number,
  letterMode: boolean,
): string {
  if (page <= 1) {
    return letterMode ? `${basePath}-1` : basePath;
  }
  return letterMode ? `${basePath}-${page}` : `${basePath}/${page}`;
}

export function CompaniesPagination({
  currentPage,
  hasMore,
  basePath,
  letterMode = false,
}: CompaniesPaginationProps) {
  const startPage = Math.max(1, currentPage - 2);
  const endPage = hasMore ? currentPage + 2 : currentPage;
  const pages = Array.from(
    { length: Math.max(0, endPage - startPage + 1) },
    (_, i) => startPage + i,
  );

  const linkStyle = {
    fontSize: 14,
    color: '#666',
    textDecoration: 'underline' as const,
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        marginTop: 32,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      {currentPage > 1 && (
        <Link href={pageHref(basePath, currentPage - 1, letterMode)} style={linkStyle}>
          ← Previous
        </Link>
      )}
      {pages.map((p) =>
        p === currentPage ? (
          <span
            key={p}
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#1a1a1a',
            }}
          >
            {p}
          </span>
        ) : (
          <Link
            key={p}
            href={pageHref(basePath, p, letterMode)}
            style={linkStyle}
          >
            {p}
          </Link>
        ),
      )}
      {hasMore && (
        <Link href={pageHref(basePath, currentPage + 1, letterMode)} style={linkStyle}>
          Next →
        </Link>
      )}
    </div>
  );
}
