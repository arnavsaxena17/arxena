import axios from 'axios';

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

    const responseObj = await response.json();
    // console.log("Relations responseObj:::", responseObj);
    return responseObj;
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
}



export async function executeQuery<T>(
  query: string, 
  variables: Record<string, any>, 
  token: string, 
  maxRetries = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const data = JSON.stringify({
        query: query,
        variables: variables,
      });

      const response = await fetch(process.env.GRAPHQL_URL_METADATA || '', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: data,
        // Add timeout configuration
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      return await response.json();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      console.log(`Retrying query attempt ${attempt + 1}/${maxRetries}`);
    }
  }
  throw new Error('Max retries exceeded');
}