import { RestApiClient } from 'twenty-client-sdk/rest';

export const postHostJson = async ({
  path,
  body,
}: {
  path: string;
  body: object;
}): Promise<unknown> => {
  const client = new RestApiClient();

  return client.post(path, body);
};
