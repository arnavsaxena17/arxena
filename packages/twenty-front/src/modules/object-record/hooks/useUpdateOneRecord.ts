import { ApolloClient, gql, useApolloClient } from '@apollo/client';

import { triggerUpdateRecordOptimisticEffect } from '@/apollo/optimistic-effect/utils/triggerUpdateRecordOptimisticEffect';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { useGetRecordFromCache } from '@/object-record/cache/hooks/useGetRecordFromCache';
import { getRecordNodeFromRecord } from '@/object-record/cache/utils/getRecordNodeFromRecord';
import { updateRecordFromCache } from '@/object-record/cache/utils/updateRecordFromCache';
import { generateDepthOneRecordGqlFields } from '@/object-record/graphql/utils/generateDepthOneRecordGqlFields';
import { useUpdateOneRecordMutation } from '@/object-record/hooks/useUpdateOneRecordMutation';
import { ObjectRecord } from '@/object-record/types/ObjectRecord';
import { getUpdateOneRecordMutationResponseField } from '@/object-record/utils/getUpdateOneRecordMutationResponseField';
import { sanitizeRecordInput } from '@/object-record/utils/sanitizeRecordInput';
import { capitalize } from '~/utils/string/capitalize';
import axios from 'axios';
import { useRecoilState } from 'recoil';
import { tokenPairState } from '@/auth/states/tokenPairState';
// import { useGoogleSheetData } from '../sheets-cache/useGoogleSheetData';
import { useSheetCache } from '../sheets-cache/useSheetCache';
import e from 'express';
type useUpdateOneRecordProps = {
  objectNameSingular: string;
  recordGqlFields?: Record<string, any>;
};

const findManyCandidatesQuery = gql`
  query FindManyCandidates($filter: CandidateFilterInput, $orderBy: [CandidateOrderByInput], $lastCursor: String, $limit: Int) {
    candidates(filter: $filter, orderBy: $orderBy, first: $limit, after: $lastCursor) {
      edges {
        node {
          id
          name
          jobs {
            id
            name
            isActive
            recruiterId
            jobLocation
            pathPosition
            googleSheetId
            jobCode
            createdAt
            company {
              name
              id
              domainName
              descriptionOneliner
            }
          }
        }
      }
    }
  }
`;
const getSpreadsheetIdForCandidate = async (
  apolloClient: ApolloClient<any>, 
  candidateId: string
): Promise<string | null> => {
  try {
    const { data } = await apolloClient.query({
      query: findManyCandidatesQuery,
      variables: { filter: { id: { eq: candidateId } } },
    });
    return data?.candidates.edges[0].node?.jobs?.googleSheetId || null;
  } catch (error) {
    console.error('Error fetching spreadsheet ID:', error);
    return null;
  }
};

const fetchSheetData = async (
  spreadsheetId: string,
  accessToken: string
): Promise<any> => {
  try {
    const response = await axios.get(
      `${process.env.REACT_APP_SERVER_BASE_URL}/sheets/${spreadsheetId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    return null;
  }
};


const updateGoogleSheet = async (
  accessToken: string,
  candidateId: string,
  record: any,
  apolloClient: ApolloClient<any>,
) => {
  try {
    const spreadsheetId = await getSpreadsheetIdForCandidate(apolloClient, candidateId);
    if (!spreadsheetId) {
      console.log('No spreadsheet ID found for candidate');
      return;
    }

    // Fetch current sheet data
    const sheetData = await fetchSheetData(spreadsheetId, accessToken);
    if (!sheetData?.headers?.length) return;

    // Find unique key column
    const uniqueKeyIndex = sheetData.headers.findIndex(
      (header: string) => 
        header.toLowerCase().includes('unique') && 
        header.toLowerCase().includes('key')
    );
    if (uniqueKeyIndex === -1) return;

    // Find row to update
    const rowIndex = sheetData.values.findIndex(
      (row: any[], index: number) => 
        index > 0 && row[uniqueKeyIndex] === record.uniqueStringKey
    );
    if (rowIndex === -1) return;

    // Prepare updated row data
    const updatedRow = sheetData.headers.map((header: string) => {
      if (header in record) {
        return record[header]?.toString() || '';
      }
      return sheetData.values[rowIndex][sheetData.headers.indexOf(header)] || '';
    });

    // Check if there are actual changes
    const currentRow = sheetData.values[rowIndex];
    const hasChanges = updatedRow.some(
      (value: any, index: number) => value !== currentRow[index]
    );
    if (!hasChanges) return;

    // Update the sheet
    await axios.post(
      `${process.env.REACT_APP_SERVER_BASE_URL}/sheets/${spreadsheetId}/values`,
      {
        range: `Sheet1!A${rowIndex + 1}`,
        values: [updatedRow],
      },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    console.log('Successfully updated Google Sheet');
  } catch (error) {
    console.error('Error updating Google Sheet:', error);
  }
};

export const useUpdateOneRecord = <UpdatedObjectRecord extends ObjectRecord = ObjectRecord>({ objectNameSingular, recordGqlFields }: useUpdateOneRecordProps) => {
  const apolloClient = useApolloClient();
  const [tokenPair] = useRecoilState(tokenPairState);
  // Create a wrapper function to safely use the hook


  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular,
  });

  const computedRecordGqlFields = recordGqlFields ?? generateDepthOneRecordGqlFields({ objectMetadataItem });

  const getRecordFromCache = useGetRecordFromCache({
    objectNameSingular,
  });

  const { updateOneRecordMutation } = useUpdateOneRecordMutation({
    objectNameSingular,
    recordGqlFields: computedRecordGqlFields,
  });

  const { objectMetadataItems } = useObjectMetadataItems();

  const updateOneRecord = async ({ idToUpdate, updateOneRecordInput }: { idToUpdate: string; updateOneRecordInput: Partial<Omit<UpdatedObjectRecord, 'id'>> }) => {
    const sanitizedInput = {
      ...sanitizeRecordInput({
        objectMetadataItem,
        recordInput: updateOneRecordInput,
      }),
    };

    const cachedRecord = getRecordFromCache<ObjectRecord>(idToUpdate);

    const cachedRecordWithConnection = getRecordNodeFromRecord<ObjectRecord>({
      record: cachedRecord,
      objectMetadataItem,
      objectMetadataItems,
      recordGqlFields: computedRecordGqlFields,
      computeReferences: true,
    });

    const optimisticRecord = {
      ...cachedRecord,
      ...sanitizedInput,
      ...{ id: idToUpdate },
      ...{ __typename: capitalize(objectMetadataItem.nameSingular) },
    };

    const optimisticRecordWithConnection = getRecordNodeFromRecord<ObjectRecord>({
      record: optimisticRecord,
      objectMetadataItem,
      objectMetadataItems,
      recordGqlFields: computedRecordGqlFields,
      computeReferences: true,
    });

    if (!optimisticRecordWithConnection || !cachedRecordWithConnection) {
      return null;
    }

    updateRecordFromCache({
      objectMetadataItems,
      objectMetadataItem,
      cache: apolloClient.cache,
      record: optimisticRecord,
    });

    triggerUpdateRecordOptimisticEffect({
      cache: apolloClient.cache,
      objectMetadataItem,
      currentRecord: cachedRecordWithConnection,
      updatedRecord: optimisticRecordWithConnection,
      objectMetadataItems,
    });

    const mutationResponseField = getUpdateOneRecordMutationResponseField(objectNameSingular);

    const updatedRecord = await apolloClient.mutate({
      mutation: updateOneRecordMutation,
      variables: {
        idToUpdate,
        input: sanitizedInput,
      },
      update: (cache, { data }) => {
        const record = data?.[mutationResponseField];

        if (!record || !cachedRecord) return;

        triggerUpdateRecordOptimisticEffect({
          cache,
          objectMetadataItem,
          currentRecord: cachedRecord,
          updatedRecord: record,
          objectMetadataItems,
        });
      },
    });

    const record = updatedRecord?.data?.[mutationResponseField];
    if (record && objectNameSingular === 'candidate' && tokenPair?.accessToken?.token) {
      try {
        await updateGoogleSheet(
          tokenPair?.accessToken?.token,
          idToUpdate,
          record,
          apolloClient
        );
      } catch (error) {
        console.error('Error updating Google Sheet:', error);
      }
    }

    return record ?? null;
  };

  return {
    updateOneRecord,
  };
};

function setCache(spreadsheetId: string, sheetData: any) {
  throw new Error('Function not implemented.');
}
