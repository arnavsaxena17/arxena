import { randomUUID } from 'crypto';

import { destroyManyObjectsMetadata } from 'test/integration/graphql/suites/inputs-validation/utils/destroy-many-objects-metadata';
import { setupTestObjectsWithAllFieldTypes } from 'test/integration/graphql/suites/inputs-validation/utils/setup-test-objects-with-all-field-types.util';
import { createOneOperationFactory } from 'test/integration/graphql/utils/create-one-operation-factory.util';
import { destroyOneOperationFactory } from 'test/integration/graphql/utils/destroy-one-operation-factory.util';
import { groupByOperationFactory } from 'test/integration/graphql/utils/group-by-operation-factory.util';
import { makeGraphqlAPIRequest } from 'test/integration/graphql/utils/make-graphql-api-request.util';

describe('RAW_JSON path group by (integration)', () => {
  let objectMetadataSingularName: string;
  let objectMetadataPluralName: string;
  let objectMetadataId: string;
  let targetObjectMetadata1Id: string;
  let targetObjectMetadata2Id: string;

  const recordIdA = randomUUID();
  const recordIdB = randomUUID();
  const recordIdC = randomUUID();

  beforeAll(async () => {
    const setupTest = await setupTestObjectsWithAllFieldTypes();

    objectMetadataId = setupTest.objectMetadataId;
    objectMetadataSingularName = setupTest.objectMetadataSingularName;
    objectMetadataPluralName = setupTest.objectMetadataPluralName;
    targetObjectMetadata1Id = setupTest.targetObjectMetadata1Id;
    targetObjectMetadata2Id = setupTest.targetObjectMetadata2Id;
  });

  afterAll(async () => {
    await destroyManyObjectsMetadata([
      objectMetadataId,
      targetObjectMetadata1Id,
      targetObjectMetadata2Id,
    ]);
  });

  afterEach(async () => {
    for (const recordId of [recordIdA, recordIdB, recordIdC]) {
      await makeGraphqlAPIRequest(
        destroyOneOperationFactory({
          objectMetadataSingularName,
          gqlFields: 'id',
          recordId,
        }),
      );
    }
  });

  it('groups by RAW_JSON scalar path and aggregates numeric path', async () => {
    await makeGraphqlAPIRequest(
      createOneOperationFactory({
        objectMetadataSingularName,
        gqlFields: 'id rawJsonField',
        data: {
          id: recordIdA,
          rawJsonField: {
            timeToFirstContactBucket: 'D1_3',
            daysToFirstContact: 2,
            meetingBookedAt: '2026-01-01T00:00:00.000Z',
          },
        },
      }),
    );
    await makeGraphqlAPIRequest(
      createOneOperationFactory({
        objectMetadataSingularName,
        gqlFields: 'id rawJsonField',
        data: {
          id: recordIdB,
          rawJsonField: {
            timeToFirstContactBucket: 'D1_3',
            daysToFirstContact: 4,
          },
        },
      }),
    );
    await makeGraphqlAPIRequest(
      createOneOperationFactory({
        objectMetadataSingularName,
        gqlFields: 'id rawJsonField',
        data: {
          id: recordIdC,
          rawJsonField: {
            timeToFirstContactBucket: 'UNDER_1D',
            daysToFirstContact: 1,
          },
        },
      }),
    );

    const groupByResponse = await makeGraphqlAPIRequest(
      groupByOperationFactory({
        objectMetadataSingularName,
        objectMetadataPluralName,
        groupBy: [{ rawJsonField: { timeToFirstContactBucket: true } }],
        gqlFields:
          'avgRawJsonFieldDaysToFirstContact countNotEmptyRawJsonFieldMeetingBookedAt',
      }),
    );

    expect(groupByResponse.body.errors).toBeUndefined();

    const buckets =
      groupByResponse.body.data?.[`${objectMetadataPluralName}GroupBy`];

    expect(buckets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupByDimensionValues: ['D1_3'],
          avgRawJsonFieldDaysToFirstContact: 3,
          countNotEmptyRawJsonFieldMeetingBookedAt: 1,
        }),
        expect.objectContaining({
          groupByDimensionValues: ['UNDER_1D'],
          avgRawJsonFieldDaysToFirstContact: 1,
          countNotEmptyRawJsonFieldMeetingBookedAt: 0,
        }),
      ]),
    );
  });
});
