
// export async function executeQuery<T>(query: string, variables: Record<string, any>, token: string): Promise<T> {
//   try {
//     let data = JSON.stringify({
//       query: query,
//       variables: variables,
//     });

//     const response = await fetch(process.env.GRAPHQL_URL_METADATA || '', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': `Bearer ${token}`,
//       },
//       body: data,
//     });

//     const responseObj = await response.json();
//     // console.log("Relations responseObj:::", responseObj);
//     return responseObj;
//   } catch (error) {
//     console.error('Error executing query:', error);
//     throw error;
//   }
// }

/** GraphQL returned an errors payload — do not retry (not a transient failure). */
export class WorkspaceMetadataGraphqlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceMetadataGraphqlError';
  }
}

type GraphQLHttpResponse<T = unknown> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

const getGraphQlErrorsMessage = (
  responseObj: GraphQLHttpResponse,
): string | null => {
  if (!Array.isArray(responseObj.errors) || responseObj.errors.length === 0) {
    return null;
  }
  const parts = responseObj.errors
    .map((e) => e.message)
    .filter((m): m is string => typeof m === 'string' && m.length > 0);
  return parts.length > 0 ? parts.join('; ') : 'GraphQL request failed';
};

export async function executeGraphQLQuery<T>(query: string, variables: Record<string, any>, token: string): Promise<T> {
  try {
    let data = JSON.stringify({
      query: query,
      variables: variables,
    });

    const response = await fetch(process.env.GRAPHQL_URL || '', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: data,
    });

    const responseObj = (await response.json()) as GraphQLHttpResponse<T>;
    const graphqlMessage = getGraphQlErrorsMessage(responseObj);
    if (graphqlMessage) {
      throw new WorkspaceMetadataGraphqlError(graphqlMessage);
    }
    if (!response.ok) {
      throw new WorkspaceMetadataGraphqlError(
        `GraphQL HTTP ${response.status} ${response.statusText}`,
      );
    }
    return responseObj as T;
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
}



export async function executeQuery<T>(
  query: string, 
  variables: Record<string, any>, 
  token: string, 
  origin: string,
  maxRetries = 3,
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const data = JSON.stringify({
        query: query,
        variables: variables,
      });

      console.log("Going to fetch executeQuery using process.env.GRAPHQL_URL_METADATA::", origin);

      const response = await fetch(process.env.GRAPHQL_URL_METADATA || '', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(origin && { Origin: origin }),
          'Authorization': `Bearer ${token}`,
        },
        body: data,
      });
      const responseObj = (await response.json()) as GraphQLHttpResponse<T>;
      const graphqlMessage = getGraphQlErrorsMessage(responseObj);
      if (graphqlMessage) {
        console.error('Metadata GraphQL errors:', responseObj.errors);
        throw new WorkspaceMetadataGraphqlError(graphqlMessage);
      }
      if (!response.ok) {
        throw new WorkspaceMetadataGraphqlError(
          `Metadata GraphQL HTTP ${response.status} ${response.statusText}`,
        );
      }
      return responseObj as T;
    } catch (error) {
      if (error instanceof WorkspaceMetadataGraphqlError) {
        throw error;
      }
      if (attempt === maxRetries) throw error;
      
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      console.log(`Retrying query attempt ${attempt + 1}/${maxRetries}`);
    }
  }
  throw new Error('Max retries exceeded');
}