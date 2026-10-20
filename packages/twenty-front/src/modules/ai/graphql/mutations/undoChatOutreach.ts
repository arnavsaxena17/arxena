import { gql } from '@apollo/client';

export const UNDO_CHAT_OUTREACH = gql`
  mutation UndoChatOutreach($threadId: UUID!) {
    undoChatOutreach(threadId: $threadId) {
      threadId
      message
      columnsRemoved {
        projectId
        subject
        columnKeys
        rowsTouched
        ephemeralUpdated
        crmUpdated
      }
      viewsCleared {
        projectId
        tab
      }
    }
  }
`;
