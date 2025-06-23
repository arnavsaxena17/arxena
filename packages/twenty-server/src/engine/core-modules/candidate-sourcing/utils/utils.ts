import axios from 'axios';

export async function axiosRequestForMetadata(data: string, apiToken: string) {
  const response = await axios.request({
    method: 'post',
    url: process.env.GRAPHQL_URL_METADATA,
    headers: {
      authorization: 'Bearer ' + apiToken,
      'content-type': 'application/json',
    },
    timeout: 10000,
    data: data,
  });
  if (response.data.errors) {
    console.log('Error axiosRequestForMetadata', response.data, "for grapqhl request of ::", data);
  }
  return response;
}
