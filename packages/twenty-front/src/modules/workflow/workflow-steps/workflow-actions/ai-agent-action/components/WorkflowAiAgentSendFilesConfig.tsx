import { WorkflowSendEmailAttachments } from '@/advanced-text-editor/components/WorkflowSendEmailAttachments';
import { Select } from '@/ui/input/components/Select';
import { useMutation } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { isNonEmptyString } from '@sniptt/guards';
import { useState } from 'react';
import {
  type AgentToolConfigs,
  type SendFilesFileSource,
  type SendFilesToolConfig,
} from 'twenty-shared/ai';
import { type WorkflowEmailFiles } from 'twenty-shared/workflow';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import {
  UpdateOneAgentDocument,
  type AgentFieldsFragment,
} from '~/generated-metadata/graphql';

const StyledRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
`;

const StyledHint = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.45;
  margin: 0;
`;

type WorkflowAiAgentSendFilesConfigProps = {
  agent: AgentFieldsFragment;
  readonly: boolean;
  onAgentUpdate: (agent: AgentFieldsFragment) => void;
};

const parseSendFilesConfig = (
  toolConfigs: unknown,
): SendFilesToolConfig => {
  if (
    toolConfigs === null ||
    typeof toolConfigs !== 'object' ||
    Array.isArray(toolConfigs)
  ) {
    return { fileSource: 'sender_collateral', fileIds: [] };
  }

  const sendFiles = (toolConfigs as AgentToolConfigs).send_files;

  if (!isDefined(sendFiles) || typeof sendFiles !== 'object') {
    return { fileSource: 'sender_collateral', fileIds: [] };
  }

  return {
    fileSource:
      sendFiles.fileSource === 'configured_files'
        ? 'configured_files'
        : 'sender_collateral',
    fileIds: Array.isArray(sendFiles.fileIds)
      ? sendFiles.fileIds.filter(isNonEmptyString)
      : [],
    files: Array.isArray(sendFiles.files)
      ? sendFiles.files.filter(
          (file): file is { id: string; name: string; type?: string } =>
            typeof file === 'object' &&
            file !== null &&
            isNonEmptyString((file as { id?: string }).id),
        )
      : undefined,
    workspaceMemberId: isNonEmptyString(sendFiles.workspaceMemberId)
      ? sendFiles.workspaceMemberId
      : undefined,
    allowedChannels: sendFiles.allowedChannels,
  };
};

const toAttachmentFiles = (
  config: SendFilesToolConfig,
): WorkflowEmailFiles => {
  if (Array.isArray(config.files) && config.files.length > 0) {
    return config.files.map((file) => ({
      id: file.id,
      name: file.name,
      size: 0,
      type: file.type ?? '',
      createdAt: new Date().toISOString(),
    }));
  }

  return (config.fileIds ?? []).map((fileId) => ({
    id: fileId,
    name: fileId,
    size: 0,
    type: '',
    createdAt: new Date().toISOString(),
  }));
};

export const WorkflowAiAgentSendFilesConfig = ({
  agent,
  readonly,
  onAgentUpdate,
}: WorkflowAiAgentSendFilesConfigProps) => {
  const [updateAgent] = useMutation(UpdateOneAgentDocument);
  const [config, setConfig] = useState(() =>
    parseSendFilesConfig(agent.toolConfigs),
  );

  const persistConfig = async (nextConfig: SendFilesToolConfig) => {
    setConfig(nextConfig);

    if (readonly) {
      return;
    }

    const nextToolConfigs: AgentToolConfigs = {
      ...((agent.toolConfigs as AgentToolConfigs | null) ?? {}),
      send_files: nextConfig,
    };

    const response = await updateAgent({
      variables: {
        input: {
          id: agent.id,
          toolConfigs: nextToolConfigs,
        },
      },
    });

    if (isDefined(response.data?.updateOneAgent)) {
      onAgentUpdate(response.data.updateOneAgent);
    }
  };

  return (
    <StyledRoot>
      <Select
        label={t`Send Files source`}
        dropdownId={`ai-agent-send-files-source-${agent.id}`}
        options={[
          {
            value: 'sender_collateral' satisfies SendFilesFileSource,
            label: t`Sender collateral (Outreach setup)`,
          },
          {
            value: 'configured_files' satisfies SendFilesFileSource,
            label: t`Configured files`,
          },
        ]}
        value={config.fileSource}
        onChange={(value) => {
          void persistConfig({
            ...config,
            fileSource: value as SendFilesFileSource,
          });
        }}
        disabled={readonly}
      />

      {config.fileSource === 'configured_files' ? (
        <WorkflowSendEmailAttachments
          label={t`Attachments`}
          files={toAttachmentFiles(config)}
          onChange={(files) => {
            const nextFiles = files
              .filter(
                (file): file is Exclude<(typeof files)[number], string> =>
                  typeof file !== 'string',
              )
              .map((file) => ({
                id: file.id,
                name: file.name,
                type: file.type,
              }));

            void persistConfig({
              ...config,
              files: nextFiles,
              fileIds: nextFiles.map((file) => file.id),
            });
          }}
          readonly={readonly}
        />
      ) : (
        <StyledHint>
          {t`Uses files uploaded under Outreach setup → Sender profile → Attachments. The agent decides whether to call send_files.`}
        </StyledHint>
      )}
    </StyledRoot>
  );
};
