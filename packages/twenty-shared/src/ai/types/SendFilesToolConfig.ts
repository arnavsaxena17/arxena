export const SEND_FILES_CHANNELS = [
  'linkedin',
  'email',
  'whatsapp',
] as const;

export type SendFilesChannel = (typeof SEND_FILES_CHANNELS)[number];

export const SEND_FILES_FILE_SOURCES = [
  'configured_files',
  'sender_collateral',
] as const;

export type SendFilesFileSource = (typeof SEND_FILES_FILE_SOURCES)[number];

export type SendFilesToolConfig = {
  fileSource: SendFilesFileSource;
  fileIds?: string[];
  files?: Array<{ id: string; name: string; type?: string }>;
  workspaceMemberId?: string;
  allowedChannels?: SendFilesChannel[];
};

export type AgentToolConfigs = {
  send_files?: SendFilesToolConfig;
};
