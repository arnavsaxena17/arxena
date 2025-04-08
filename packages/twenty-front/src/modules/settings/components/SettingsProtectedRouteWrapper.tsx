import { useHasSettingsPermission } from '@/settings/roles/hooks/useHasSettingsPermission';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { FeatureFlagKey, SettingsFeatures } from '~/generated/graphql';

type SettingsProtectedRouteWrapperProps = {
  children?: ReactNode;
  settingsPermission?: SettingsFeatures;
  requiredFeatureFlag?: FeatureFlagKey;
};

export const SettingsProtectedRouteWrapper = ({
  children,
  settingsPermission,
  requiredFeatureFlag,
}: SettingsProtectedRouteWrapperProps) => {
  const isPermissionsEnabled = useIsFeatureEnabled(
    FeatureFlagKey.IsPermissionsEnabled,
  );
  const hasPermission = useHasSettingsPermission(settingsPermission);
  const requiredFeatureFlagEnabled = useIsFeatureEnabled(
    requiredFeatureFlag || null,
  );
  console.log('requiredFeatureFlagEnabled', requiredFeatureFlagEnabled);

  // if (
  //   (requiredFeatureFlag && !requiredFeatureFlagEnabled) ||
  //   (!hasPermission && isPermissionsEnabled)
  // ) {
    // return <Navigate to={getSettingsPath(SettingsPath.ProfilePage)} replace />;
  // }

  return children ?? <Outlet />;
};
