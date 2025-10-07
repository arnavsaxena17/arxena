import { tokenPairState } from '@/auth/states/tokenPairState';
import axios from 'axios';
import { useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import { findManyAttachmentsQuery } from 'twenty-shared';

type AttachmentFilter = {
  candidateId?: { eq: string };
  jobId?: { eq: string };
  cvSentId?: { eq: string };
};

type AttachmentOrderBy = Array<{
  createdAt?: 'AscNullsFirst' | 'AscNullsLast' | 'DescNullsFirst' | 'DescNullsLast';
}>;

type AttachmentNode = {
  id: string;
  name: string;
  fullPath: string;
  createdAt: string;
};

type AttachmentEdge = {
  node: AttachmentNode;
};

type FindManyAttachmentsResponse = {
  data?: {
    attachments?: {
      edges?: AttachmentEdge[];
    };
  };
};

export const useFindManyAttachments = () => {
  const tokenPair = useRecoilValue(tokenPairState);

  const findManyAttachments = useCallback(
    async ({
      filter,
      orderBy = [{ createdAt: 'DescNullsFirst' }],
      limit,
    }: {
      filter: AttachmentFilter;
      orderBy?: AttachmentOrderBy;
      limit?: number;
    }): Promise<AttachmentNode[]> => {
      try {
        const response = await axios.post<FindManyAttachmentsResponse>(
          `${process.env.REACT_APP_SERVER_BASE_URL}/graphql`,
          {
            operationName: 'FindManyAttachments',
            variables: {
              filter,
              orderBy,
              ...(limit && { limit }),
            },
            query: findManyAttachmentsQuery,
          },
          {
            headers: {
              Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
              'Content-Type': 'application/json',
            },
          },
        );

        const attachments = response.data?.data?.attachments?.edges?.map(
          (edge) => edge.node,
        ) || [];

        return attachments;
      } catch (error) {
        console.error('Error fetching attachments:', error);
        throw error;
      }
    },
    [tokenPair],
  );

  return {
    findManyAttachments,
  };
};
