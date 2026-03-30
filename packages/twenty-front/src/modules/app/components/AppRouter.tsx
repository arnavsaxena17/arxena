import { useCreateAppRouter } from '@/app/hooks/useCreateAppRouter';
import { useMemo } from 'react';
import { RouterProvider } from 'react-router-dom';

export const AppRouter = () => {
  // We want to disable serverless function settings but keep the code for now
  const isFunctionSettingsEnabled = true;

  const isAdminPageEnabled = true;
  console.log('isAdminPageEnabled', isAdminPageEnabled);
  const router = useMemo(
    () =>
      useCreateAppRouter(isFunctionSettingsEnabled, isAdminPageEnabled),
    [isFunctionSettingsEnabled, isAdminPageEnabled],
  );

  return <RouterProvider router={router} />;
};
