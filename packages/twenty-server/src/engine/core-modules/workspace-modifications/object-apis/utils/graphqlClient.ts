import axios from 'axios';
import * as https from 'https';


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

// export async function executeGraphQLQuery<T>(query: string, variables: Record<string, any>, token: string): Promise<T> {
//   try {
//     let data = JSON.stringify({
//       query: query,
//       variables: variables,
//     });

//     const response = await fetch(process.env.GRAPHQL_URL || '', {
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



export async function executeGraphQLQuery<T>(
  query: string, 
  variables: Record<string, any>, 
  token: string, 
  maxRetries = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios({
        method: 'post',
        url: process.env.GRAPHQL_URL || '',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Origin': process.env.APPLE_ORIGIN_URL,
        },
        data: {
          query,
          variables
        },
        timeout: 30000,
        // You can configure SSL/TLS options here
        httpsAgent: new https.Agent({
          rejectUnauthorized: process.env.NODE_ENV === 'production', // In dev, may need to set to false
          secureProtocol: 'TLSv1_2_method' // Force TLSv1.2
        })
      });

      console.log("Received response:", response.data);
      
      if (response.data.errors) {
        console.error("GraphQL errors:", response.data.errors);
        throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
      }
      
      return response.data;
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) throw error;
      
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      console.log(`Waiting ${delay}ms before retry`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      console.log(`Retrying query attempt ${attempt + 1}/${maxRetries}`);
    }
  }
  throw new Error('Max retries exceeded');
}






  export async function executeQuery<T>(
    query: string, 
    variables: Record<string, any>, 
    token: string, 
    maxRetries = 3
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios({
          method: 'post',
          url: process.env.GRAPHQL_URL_METADATA || '',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Origin': process.env.APPLE_ORIGIN_URL,
          },
          data: {
            query,
            variables
          },
          timeout: 30000,
          // You can configure SSL/TLS options here
          httpsAgent: new https.Agent({
            rejectUnauthorized: process.env.NODE_ENV === 'production', // In dev, may need to set to false
            secureProtocol: 'TLSv1_2_method' // Force TLSv1.2
          })
        });
  
        console.log("Received response:", response.data);
        
        if (response.data.errors) {
          console.error("GraphQL errors:", response.data.errors);
          throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
        }
        
        return response.data;
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error);
        
        if (attempt === maxRetries) throw error;
        
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.log(`Waiting ${delay}ms before retry`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        console.log(`Retrying query attempt ${attempt + 1}/${maxRetries}`);
      }
    }
    throw new Error('Max retries exceeded');
  }
  