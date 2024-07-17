import axios from 'axios';

export async function axiosRequest(data: string) {
  const response = await axios.request({
    method: 'post',
    url: process.env.GRAPHQL_URL,
    headers: {
      authorization: 'Bearer ' + process.env.TWENTY_JWT_SECRET,
      'content-type': 'application/json',
    },
    data: data,
  });
  return response;
}
