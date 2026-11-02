import { isDefined } from 'twenty-shared/utils';
import { OnboardingStatus } from '~/generated-metadata/graphql';

type GetHasJustCompletedOnboardingArgs = {
  previousOnboardingStatus: OnboardingStatus | null | undefined;
  nextOnboardingStatus: OnboardingStatus | null | undefined;
};

export const getHasJustCompletedOnboarding = ({
  previousOnboardingStatus,
  nextOnboardingStatus,
}: GetHasJustCompletedOnboardingArgs): boolean =>
  nextOnboardingStatus === OnboardingStatus.COMPLETED &&
  isDefined(previousOnboardingStatus) &&
  previousOnboardingStatus !== OnboardingStatus.COMPLETED;
