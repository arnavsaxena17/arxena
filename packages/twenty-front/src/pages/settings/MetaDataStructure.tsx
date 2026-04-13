import { tokenPairState } from '@/auth/states/tokenPairState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import styled from '@emotion/styled';
import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { isOrgChartEnabledEnv } from 'twenty-shared';
import {
  Button,
  IconPlus,
  IconRefresh,
  IconRocket,
} from 'twenty-ui';
import { useWebSocketEvent } from '../../modules/websocket-context/useWebSocketEvent';
import { useWebSocket } from '../../modules/websocket-context/WebSocketContextProvider';

const StyledButtonContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-top: ${({ theme }) => theme.spacing(2)};
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
  const [tokenPair] = useRecoilState(tokenPairState);
  const [hasBeenClicked, setHasBeenClicked] = useState(() => {
    return localStorage.getItem('metadata-structure-created') === 'true';
  });
  const { connected, socket } = useWebSocket();
  const { enqueueSnackBar } = useSnackBar();

  console.log('MetadataStructureSection rendered, socket:', !!socket, 'connected:', connected);

  // Direct event handler using socket
  useEffect(() => {
    if (!socket) return;
    
    console.log('Setting up direct socket event listener for metadata-structure-progress');
    
    const handleProgressEvent = (data: any) => {
      console.log('Direct socket listener received:', data);
      
      if (data?.message) {
        let variant = SnackBarVariant.Info;
        
        if (data.step === 'candidate-view-updated') {
          variant = SnackBarVariant.Success;
        }
        
        if (data.step === 'metadata-structure-complete') {
          variant = SnackBarVariant.Success;
          enqueueSnackBar(data.message, { variant });
          
          // Give the snackbar time to display before reloading
          // console.log('Reloading page in 3 seconds due to metadata-structure-complete event');
          // setTimeout(() => {
          //   window.location.reload();
          // }, 3000);
          return;
        }
        
        enqueueSnackBar(data.message, { variant });
      }
    };
    
    socket.on('metadata-structure-progress', handleProgressEvent);
    
    return () => {
      console.log('Cleaning up direct socket event listener');
      socket.off('metadata-structure-progress', handleProgressEvent);
    };
  }, [socket, enqueueSnackBar]);

  // Also keep the original hook for backup
  useWebSocketEvent<{ step: string; message: string }>(
    'metadata-structure-progress',
    (data: { step: string; message: string }) => {
      console.log('useWebSocketEvent hook received:', data);
      
      if (data?.message) {
        let variant = SnackBarVariant.Info;
        
        console.log('data::', data);
        console.log('data.step::', data.step);
        
        if (data.step === 'candidate-view-updated') {
          variant = SnackBarVariant.Success;
        }
        
        if (data.step === 'metadata-structure-complete') {
          variant = SnackBarVariant.Success;
          enqueueSnackBar(data.message, { variant });
          
          // Give the snackbar time to display before reloading
          console.log('Reloading page in 3 seconds due to metadata-structure-complete event');
          // setTimeout(() => {
          //   console.log('Reloading page in 3 seconds due to metadata-structure-complete event');
          //   window.location.reload();
          // }, 3000);
          return;
        }
        
        enqueueSnackBar(data.message, { variant });
      }
    },
    []
  );

  useEffect(() => {
    if (connected) {
      enqueueSnackBar('Connected to server', { variant: SnackBarVariant.Info });
      console.log('WebSocket connected status changed to:', connected);
    }
  }, [connected, enqueueSnackBar]);

  useEffect(() => {
    console.log("workspace useeffect??")
    if (!tokenPair?.accessToken?.token) return;
    fetch(
      `${process.env.REACT_APP_SERVER_BASE_URL}/workspace-modifications/workspace-keys`,
      {
        headers: {
          Authorization: `Bearer ${tokenPair.accessToken.token}`,
        },
      },
    )
      .then((res) => res.json())
      .then((keys) => {
        const flag = keys?.is_org_chart_enabled;
        setIsOrgChartEnabled(
          flag === undefined ? isOrgChartEnabledEnv : flag === 'true',
        );
      })
      .catch(() => setIsOrgChartEnabled(isOrgChartEnabledEnv));
  }, [tokenPair?.accessToken?.token]);

  const handleUpgradeToEngagementWorkflows = async () => {
    if (isUpgrading) return;
    setIsUpgrading(true);

    try {
      const response = await fetch(
        `${process.env.REACT_APP_SERVER_BASE_URL}/workspace-modifications/upgrade-to-engagement-workflows`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
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

      enqueueSnackBar('Upgraded to Engagement Workflows successfully', {
        variant: SnackBarVariant.Success,
      });
      setIsOrgChartEnabled(false);
      // setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      enqueueSnackBar(
        error instanceof Error
          ? `Failed to upgrade: ${error.message}`
          : 'Failed to upgrade to Engagement Workflows',
        {
          variant: SnackBarVariant.Error,
        },
      );
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleCreateStructure = async () => {
    if (isSubmitting || hasBeenClicked) return;
    setIsSubmitting(true);
    setHasBeenClicked(true);
    localStorage.setItem('metadata-structure-created', 'true');

    try {
      const response = await fetch(
        `${process.env.REACT_APP_SERVER_BASE_URL}/workspace-modifications/create-metadata-structure`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
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

      enqueueSnackBar('Started metadata structure creation process', {
        variant: SnackBarVariant.Info,
      });
    } catch (error) {
      enqueueSnackBar(
        error instanceof Error
          ? `Failed to create metadata structure: ${error.message}`
          : 'Failed to create metadata structure',
        {
          variant: SnackBarVariant.Error,
        },
      );
      setHasBeenClicked(false);
      localStorage.removeItem('metadata-structure-created');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStructure = async () => {
    if (isUpdating) return;
    setIsUpdating(true);

    try {
      const response = await fetch(
        `${process.env.REACT_APP_SERVER_BASE_URL}/workspace-modifications/update-metadata-structure`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
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

      enqueueSnackBar('Started metadata structure update process', {
        variant: SnackBarVariant.Info,
      });
    } catch (error) {
      enqueueSnackBar(
        error instanceof Error
          ? `Failed to update metadata structure: ${error.message}`
          : 'Failed to update metadata structure',
        {
          variant: SnackBarVariant.Error,
        },
      );
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
