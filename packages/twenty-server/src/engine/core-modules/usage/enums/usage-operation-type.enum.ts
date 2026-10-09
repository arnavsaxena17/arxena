/* @license Enterprise */

import { registerEnumType } from '@nestjs/graphql';

export enum UsageOperationType {
  AI_CHAT_TOKEN = 'AI_CHAT_TOKEN',
  AI_WORKFLOW_TOKEN = 'AI_WORKFLOW_TOKEN',
  AI_BACKGROUND_TOKEN = 'AI_BACKGROUND_TOKEN',
  AI_TRANSCRIPTION = 'AI_TRANSCRIPTION',
  WORKFLOW_EXECUTION = 'WORKFLOW_EXECUTION',
  CODE_EXECUTION = 'CODE_EXECUTION',
  WEB_SEARCH = 'WEB_SEARCH',
  CALL_RECORDING = 'CALL_RECORDING',
  EMAIL_SEND = 'EMAIL_SEND',
  BRIGHT_DATA_SEARCH = 'BRIGHT_DATA_SEARCH',
}

registerEnumType(UsageOperationType, {
  name: 'UsageOperationType',
});
