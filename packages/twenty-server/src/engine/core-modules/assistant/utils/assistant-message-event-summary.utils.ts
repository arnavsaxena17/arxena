const summarizeObjectEntries = (
  obj: Record<string, unknown>,
  preferredKeys: string[],
) => {
  const parts = preferredKeys
    .map((key) => {
      const value = obj[key];

      if (value == null) return null;
      if (Array.isArray(value)) {
        return value.length > 0 ? `${key}: ${value.join(', ')}` : null;
      }
      if (typeof value === 'string' || typeof value === 'number') {
        return `${key}: ${value}`;
      }

      return null;
    })
    .filter((value): value is string => Boolean(value));

  return parts.slice(0, 3).join(' | ');
};

export const summarizeMessageEvent = (
  eventType: string,
  payload: Record<string, unknown>,
): string | null => {
  const chatMessage =
    typeof payload.chatMessage === 'string' ? payload.chatMessage.trim() : '';

  if (chatMessage) return chatMessage;

  const data =
    payload.data && typeof payload.data === 'object'
      ? (payload.data as Record<string, unknown>)
      : null;

  if (!data) {
    return eventType ? eventType.replace(/_/g, ' ') : null;
  }

  if (eventType === 'parsed_requirement') {
    const details = summarizeObjectEntries(data, [
      'position_title',
      'original_requirement',
      'query_type_description',
    ]);

    return details ? `Parsed requirement: ${details}` : 'Parsed requirement';
  }

  if (eventType === 'primary_query') {
    const query =
      data.query && typeof data.query === 'object'
        ? (data.query as Record<string, unknown>)
        : null;
    const details = query
      ? summarizeObjectEntries(query, ['job_title', 'keywords', 'location'])
      : summarizeObjectEntries(data, [
          'recommended_strategy',
          'splitting_reason',
        ]);

    return details ? `Built primary query: ${details}` : 'Built primary query';
  }

  if (eventType === 'query_set' || eventType === 'splitting_strategy') {
    const count =
      typeof data.total_queries === 'number'
        ? data.total_queries
        : typeof data.query_count === 'number'
          ? data.query_count
          : Array.isArray(data.queries)
            ? data.queries.length
            : Array.isArray(data.query_set)
              ? data.query_set.length
              : null;

    return count != null
      ? `Generated ${count} search quer${count === 1 ? 'y' : 'ies'}`
      : 'Generated search queries';
  }

  if (eventType === 'unresolved_search_parameters') {
    return 'Produced unresolved search parameters';
  }

  if (eventType === 'orchestrator_result') {
    return 'Prepared orchestrated search strategy';
  }

  if (eventType === 'master_lists') {
    return 'Generated master lists';
  }

  const count =
    typeof data.count === 'number'
      ? data.count
      : typeof data.totalCount === 'number'
        ? data.totalCount
        : typeof data.total === 'number'
          ? data.total
          : null;

  if (count != null) {
    return `${eventType.replace(/_/g, ' ')}: ${count} item${count === 1 ? '' : 's'}`;
  }

  const genericDetails = summarizeObjectEntries(data, [
    'label',
    'query_type_description',
    'recommended_strategy',
  ]);

  return genericDetails
    ? `${eventType.replace(/_/g, ' ')}: ${genericDetails}`
    : eventType.replace(/_/g, ' ');
};
