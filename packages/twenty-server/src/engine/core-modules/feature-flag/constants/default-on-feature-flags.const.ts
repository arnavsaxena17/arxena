import { FeatureFlagKey } from 'src/engine/core-modules/feature-flag/enums/feature-flag-key.enum';

/** Flags that are enabled when no workspace row exists (opt-out via value: false). */
export const DEFAULT_ON_FEATURE_FLAGS: FeatureFlagKey[] = [
  FeatureFlagKey.IsUnipileConnectionDisconnectionEnabled,
];

export const isDefaultOnFeatureFlag = (key: FeatureFlagKey): boolean =>
  DEFAULT_ON_FEATURE_FLAGS.includes(key);
