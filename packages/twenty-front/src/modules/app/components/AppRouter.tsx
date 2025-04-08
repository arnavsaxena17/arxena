import { useCreateAppRouter } from '@/app/hooks/useCreateAppRouter';
import { currentUserState } from '@/auth/states/currentUserState';
import { RouterProvider } from 'react-router-dom';
import { useRecoilValue } from 'recoil';

export const AppRouter = () => {
  // We want to disable serverless function settings but keep the code for now
  const isFunctionSettingsEnabled = true;

  const currentUser = useRecoilValue(currentUserState);
  // const isAdminPageEnabled = currentUser?.canImpersonate;
  const isAdminPageEnabled = true;
  console.log('isAdminPageEnabled', isAdminPageEnabled);

  return (
    <RouterProvider
      router={useCreateAppRouter(isFunctionSettingsEnabled, isAdminPageEnabled)}
    />
  );
};
