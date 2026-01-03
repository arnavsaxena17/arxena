import { AuthTokenPair } from '~/generated/graphql';

/**
 * Sends a message to the candidate-search endpoint
 * @param message - The message to send
 * @param searchFilterId - The search filter ID
 * @param tokenPair - The authentication token pair
 * @param additionalData - Additional data to include in the request body
 * @returns Promise that resolves to the response JSON
 */
export const sendChatMessage = async (
  message: string,
  searchFilterId: string,
  tokenPair: AuthTokenPair,
  additionalData?: Record<string, any>
) => {
  if (!tokenPair?.accessToken?.token) {
    throw new Error('Missing access token');
  }

  const response = await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}/candidate-search/${searchFilterId}/message`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      Authorization: `Bearer ${tokenPair.accessToken.token}` 
    },
    body: JSON.stringify({ 
      message,
      ...additionalData
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
};

/**
 * Sends a streaming message to the candidate-search endpoint
 * @param message - The message to send
 * @param searchFilterId - The search filter ID
 * @param tokenPair - The authentication token pair
 * @param onEvent - Callback function called for each SSE event
 * @param abortController - AbortController to cancel the request
 * @param additionalData - Additional data to include in the request body
 * @returns Promise that resolves when the stream completes
 */
export const sendChatMessageStream = async (
  message: string,
  searchFilterId: string,
  tokenPair: AuthTokenPair,
  onEvent: (event: string, data: any) => void,
  abortController?: AbortController,
  additionalData?: Record<string, any>
): Promise<void> => {
  if (!tokenPair?.accessToken?.token) {
    throw new Error('Missing access token');
  }

  const response = await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}/candidate-search/message/stream`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      Authorization: `Bearer ${tokenPair.accessToken.token}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ 
      message,
      searchFilterId,
      ...additionalData
    }),
    signal: abortController?.signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      // Check if aborted before reading
      if (abortController?.signal.aborted) {
        reader.cancel();
        onEvent('stopped', { message: 'Request terminated by user' });
        return;
      }

      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      // Check if aborted after reading
      if (abortController?.signal.aborted) {
        reader.cancel();
        onEvent('stopped', { message: 'Request terminated by user' });
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEventType = 'message';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('event: ')) {
          currentEventType = line.substring(7).trim();
          continue;
        }

        if (line.startsWith('data: ')) {
          const dataStr = line.substring(6).trim();
          if (dataStr) {
            try {
              const data = JSON.parse(dataStr);
              onEvent(currentEventType, data);
              currentEventType = 'message'; // Reset for next event
            } catch (e) {
              console.error('Failed to parse SSE data:', e, dataStr);
            }
          }
        }

        // Empty line indicates end of event
        if (line.trim() === '' && currentEventType !== 'message') {
          currentEventType = 'message';
        }
      }
    }
  } catch (error: any) {
    if (error.name === 'AbortError' || abortController?.signal.aborted) {
      onEvent('stopped', { message: 'Request terminated by user' });
      return;
    }
    throw error;
  } finally {
    reader.releaseLock();
  }
};
