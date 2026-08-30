export const parseOutreachCacheJsonResponse = async <TData>(
  response: Response,
): Promise<TData> => {
  const responseText = await response.text();
  const trimmedResponseText = responseText.trimStart();

  if (
    trimmedResponseText.startsWith('<') ||
    trimmedResponseText.startsWith('<!')
  ) {
    throw new Error(
      'Received HTML instead of JSON (API may be unavailable or misrouted)',
    );
  }

  return JSON.parse(responseText) as TData;
};
