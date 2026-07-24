// import { FeatureFlagKey } from '~/generated-metadata/graphql';

export const useNewSearchUI = () => {
  // TODO: Add IsNewSearchPanelEnabled to FeatureFlagKey enum in backend
  // const isNewSearchUIEnabled = useIsFeatureEnabled(FeatureFlagKey.IsNewSearchPanelEnabled);
  const isNewSearchUIEnabled = true; // Temporarily always enabled
  
  return {
    isNewSearchUIEnabled,
    isLegacySearchUIEnabled: !isNewSearchUIEnabled,
  };
};
