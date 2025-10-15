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
