import { RestApiClient } from 'twenty-client-sdk/rest';
import { enqueueSnackbar } from 'twenty-sdk/front-component';

export const requestAppRoute = async ({
  path,
  body,
  successMessage,
  errorMessage,
}: {
  path: string;
  body: object;
  successMessage: string;
  errorMessage: string;
}): Promise<void> => {
  try {
    await new RestApiClient().post(`/s${path}`, body);
    await enqueueSnackbar({ message: successMessage, variant: 'success' });
  } catch {
    await enqueueSnackbar({ message: errorMessage, variant: 'error' });
  }
};
