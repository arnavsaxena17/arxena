import { type CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export const DOCS_PLAYGROUND_ORIGINS = [
  'https://docs.arxena.com',
  'http://localhost:3003',
  'http://127.0.0.1:3003',
] as const;

const PLAYGROUND_ALLOWED_HEADERS = [
  'Authorization',
  'Content-Type',
  'Accept',
  'Origin',
  'X-Requested-With',
  'x-locale',
  'x-schema-version',
  'x-origin-domain',
  'X-Origin-Domain',
];

export const normalizeOriginHeader = (
  origin: string | string[] | undefined,
): string | undefined => {
  if (Array.isArray(origin)) {
    return origin[0];
  }

  return origin;
};

export const isDocsPlaygroundOrigin = (
  origin: string | undefined,
): origin is (typeof DOCS_PLAYGROUND_ORIGINS)[number] => {
  return (
    origin !== undefined &&
    (DOCS_PLAYGROUND_ORIGINS as readonly string[]).includes(origin)
  );
};

export const getCorsOptionsForRequest = (
  originHeader: string | string[] | undefined,
): CorsOptions => {
  const origin = normalizeOriginHeader(originHeader);

  if (isDocsPlaygroundOrigin(origin)) {
    return {
      origin,
      credentials: true,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: PLAYGROUND_ALLOWED_HEADERS,
      exposedHeaders: ['WWW-Authenticate'],
    };
  }

  return {
    origin: '*',
    credentials: false,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    exposedHeaders: ['WWW-Authenticate'],
  };
};

export const applyFallbackCorsHeaders = (
  response: { header: (name: string, value: string) => void },
  originHeader: string | string[] | undefined,
): void => {
  const options = getCorsOptionsForRequest(originHeader);
  const origin =
    typeof options.origin === 'string' ? options.origin : '*';
  const methods = Array.isArray(options.methods)
    ? options.methods.join(',')
    : (options.methods ?? 'GET,HEAD,PUT,PATCH,POST,DELETE');
  const allowedHeaders = Array.isArray(options.allowedHeaders)
    ? options.allowedHeaders.join(',')
    : (options.allowedHeaders ??
      'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  const exposedHeaders = Array.isArray(options.exposedHeaders)
    ? options.exposedHeaders.join(',')
    : options.exposedHeaders;

  response.header('Access-Control-Allow-Origin', origin);

  if (options.credentials) {
    response.header('Access-Control-Allow-Credentials', 'true');
  }

  response.header('Access-Control-Allow-Methods', methods);
  response.header('Access-Control-Allow-Headers', allowedHeaders);

  if (exposedHeaders) {
    response.header('Access-Control-Expose-Headers', exposedHeaders);
  }
};
