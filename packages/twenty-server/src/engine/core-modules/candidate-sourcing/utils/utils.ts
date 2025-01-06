import axios from 'axios';

export async function axiosRequest(data: string, apiToken: string) {
  const response = await axios.request({
    method: 'post',
    url: process.env.GRAPHQL_URL,
    headers: {
      authorization: 'Bearer ' + apiToken,
      'content-type': 'application/json',
    },
    data: data,
  });
  
  if (response.data.errors) {
    console.log('Error axiosRequest', response.data);
  }
  
  return response;
}
export async function axiosRequestForMetadata(data: string, apiToken: string) {
  const response = await axios.request({
    method: 'post',
    url: process.env.GRAPHQL_URL_METADATA,
    headers: {
      authorization: 'Bearer ' + apiToken,
      'content-type': 'application/json',
    },
    data: data,
  });
  if (response.data.errors) {
    console.log('Error axiosRequestForMetadata', response.data);
  }
  return response;
}

