export const backendGraphQLUrl = new URL(
  '/graphql',
  process.env.BACKEND_BASE_URL || 'http://localhost:3000',
).toString();
