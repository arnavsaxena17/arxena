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


export async function axiosRequest(data: string, apiToken: string, origin: string) {
  // console.log("Sending a post request to the graphql server:: with data", data);
  const response = await axios.request({
    method: 'post',
    url: process.env.GRAPHQL_URL,
    headers: {
      authorization: 'Bearer ' + apiToken,
      Origin: origin,
      'content-type': 'application/json',
    },
    data: data,
    timeout: 10000,
  });

  if (response.data.errors) {
    console.log(
      'Error axiosRequest',
      response.data,
      "origin is ::",
      origin,
      'for grapqhl request of ::',
      data,
      'note: token redacted',
    );
  }

  return response;
}
