import { useEffect, useState } from 'react';
import { styled } from '@linaria/react';
import { isOrgChartEnabledEnv } from 'twenty-shared/graphql';
import { IconPlus, IconRefresh, IconRocket } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useWebSocketEvent } from '@/websocket-context/useWebSocketEvent';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

const StyledButtonContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
  margin-top: ${themeCssVariables.spacing[2]};
`;

type NestErrorBody = {
  message?: string | string[];
  success?: boolean;
};

const messageFromFailedResponse = async (
  response: Response,
  fallback: string,
): Promise<string> => {
  try {
    const body = (await response.json()) as NestErrorBody;
    if (body.message !== undefined) {
      return Array.isArray(body.message)
        ? body.message.join(', ')
        : body.message;
    }
  } catch {
    // ignore JSON parse errors
  }
  return fallback;
};

export const MetadataStructureSection = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isOrgChartEnabled, setIsOrgChartEnabled] = useState<boolean | null>(
    null,
  );
  const tokenPair = useAtomStateValue(tokenPairState);
  const [hasBeenClicked, setHasBeenClicked] = useState(() => {
    return localStorage.getItem('metadata-structure-created') === 'true';
  });
  const {
    enqueueInfoSnackBar,
    enqueueSuccessSnackBar,
    enqueueErrorSnackBar,
  } = useSnackBar();

  useWebSocketEvent<{ step: string; message: string }>(
    'metadata-structure-progress',
    (data: { step: string; message: string }) => {
      if (!data?.message) {
        return;
      }

      if (
        data.step === 'candidate-view-updated' ||
        data.step === 'metadata-structure-complete'
      ) {
        enqueueSuccessSnackBar({ message: data.message });
        return;
      }

      enqueueInfoSnackBar({ message: data.message });
    },
    [],
  );

  useEffect(() => {
    if (!tokenPair?.accessOrWorkspaceAgnosticToken?.token) {
      return;
    }

    fetch(`${REACT_APP_SERVER_BASE_URL}/workspace-modifications/workspace-keys`, {
      headers: {
        Authorization: `Bearer ${tokenPair.accessOrWorkspaceAgnosticToken.token}`,
      },
    })
      .then((response) => response.json())
      .then((keys) => {
        const flag = keys?.is_org_chart_enabled;
        setIsOrgChartEnabled(
          flag === undefined ? isOrgChartEnabledEnv : flag === 'true',
        );
      })
      .catch(() => setIsOrgChartEnabled(isOrgChartEnabledEnv));
  }, [tokenPair?.accessOrWorkspaceAgnosticToken?.token]);

  const handleUpgradeToEngagementWorkflows = async () => {
    if (isUpgrading) {
      return;
    }
    setIsUpgrading(true);

    try {
      const response = await fetch(
        `${REACT_APP_SERVER_BASE_URL}/workspace-modifications/upgrade-to-engagement-workflows`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          await messageFromFailedResponse(
            response,
            'Failed to upgrade to Engagement Workflows',
          ),
        );
      }

      enqueueSuccessSnackBar({
        message: 'Upgraded to Engagement Workflows successfully',
      });
      setIsOrgChartEnabled(false);
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? `Failed to upgrade: ${error.message}`
            : 'Failed to upgrade to Engagement Workflows',
      });
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleCreateStructure = async () => {
    if (isSubmitting || hasBeenClicked) {
      return;
    }
    setIsSubmitting(true);
    setHasBeenClicked(true);
    localStorage.setItem('metadata-structure-created', 'true');

    try {
      const response = await fetch(
        `${REACT_APP_SERVER_BASE_URL}/workspace-modifications/create-metadata-structure`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          await messageFromFailedResponse(
            response,
            'Failed to create metadata structure',
          ),
        );
      }

      enqueueInfoSnackBar({
        message: 'Started metadata structure creation process',
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? `Failed to create metadata structure: ${error.message}`
            : 'Failed to create metadata structure',
      });
      setHasBeenClicked(false);
      localStorage.removeItem('metadata-structure-created');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStructure = async () => {
    if (isUpdating) {
      return;
    }
    setIsUpdating(true);

    try {
      const response = await fetch(
        `${REACT_APP_SERVER_BASE_URL}/workspace-modifications/update-metadata-structure`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          await messageFromFailedResponse(
            response,
            'Failed to update metadata structure',
          ),
        );
      }

      enqueueInfoSnackBar({
        message: 'Started metadata structure update process',
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? `Failed to update metadata structure: ${error.message}`
            : 'Failed to update metadata structure',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <StyledButtonContainer>
      <Button
        title={
          isSubmitting
            ? 'Creating...'
            : hasBeenClicked
              ? 'Creating Structure..'
              : 'Create Metadata Structure'
        }
        Icon={IconPlus}
        accent="blue"
        disabled={isSubmitting || hasBeenClicked}
        onClick={handleCreateStructure}
      />
      <Button
        title={isUpdating ? 'Updating...' : 'Update Metadata Structure'}
        Icon={IconRefresh}
        variant="secondary"
        disabled={isUpdating}
        onClick={handleUpdateStructure}
      />
      {isOrgChartEnabled === true && (
        <Button
          title={
            isUpgrading ? 'Upgrading...' : 'Upgrade to Engagement Workflows'
          }
          Icon={IconRocket}
          variant="secondary"
          disabled={isUpgrading}
          onClick={handleUpgradeToEngagementWorkflows}
        />
      )}
    </StyledButtonContainer>
  );
};
