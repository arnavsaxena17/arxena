import { remapClonedWorkflowIds } from 'src/modules/workflow/workflow-builder/utils/remap-cloned-workflow-ids.util';

const OLD_FIND = 'bf5db0df-c7ec-4392-8c41-0845300ba790';
const NEW_FIND = '11111111-1111-4111-8111-111111111111';
const OLD_MEMBER = 'b8e1d001-4a11-4c11-8c11-000000000001';
const NEW_MEMBER = '22222222-2222-4222-8222-222222222222';
const OLD_DEFERRED = 'c7a10006-aaaa-4fcb-a7d8-17a7736ed045';
const NEW_DEFERRED = '33333333-3333-4333-8333-333333333333';

describe('remapClonedWorkflowIds', () => {
  const oldToNewIdMap = new Map([
    [OLD_FIND, NEW_FIND],
    [OLD_MEMBER, NEW_MEMBER],
    [OLD_DEFERRED, NEW_DEFERRED],
  ]);

  it('returns the value unchanged when the map is empty', () => {
    const value = { nextStepIds: [OLD_FIND] };

    expect(remapClonedWorkflowIds(value, new Map())).toBe(value);
  });

  it('remaps IF_ELSE branch nextStepIds in a single pass', () => {
    const remapped = remapClonedWorkflowIds(
      {
        id: 'new-if-else',
        nextStepIds: [],
        settings: {
          input: {
            branches: [
              { nextStepIds: [OLD_DEFERRED] },
              { nextStepIds: [OLD_MEMBER] },
            ],
          },
        },
      },
      oldToNewIdMap,
    );

    expect(remapped.settings.input.branches[0].nextStepIds).toEqual([
      NEW_DEFERRED,
    ]);
    expect(remapped.settings.input.branches[1].nextStepIds).toEqual([
      NEW_MEMBER,
    ]);
  });

  it('rewrites {{stepId}} variables in FIND filters and UPDATE record ids', () => {
    const remapped = remapClonedWorkflowIds(
      {
        settings: {
          input: {
            objectRecordId: `{{${OLD_FIND}.first.id}}`,
            filter: {
              recordFilters: [
                {
                  value: `{{${OLD_FIND}.first.jobCompanyName}}`,
                },
              ],
            },
          },
        },
      },
      oldToNewIdMap,
    );

    expect(remapped.settings.input.objectRecordId).toBe(
      `{{${NEW_FIND}.first.id}}`,
    );
    expect(remapped.settings.input.filter.recordFilters[0].value).toBe(
      `{{${NEW_FIND}.first.jobCompanyName}}`,
    );
  });

  it('does not chain-replace when a new id matches another old id', () => {
    const first = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const second = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const third = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

    const remapped = remapClonedWorkflowIds(
      { nextStepIds: [first] },
      new Map([
        [first, second],
        [second, third],
      ]),
    );

    expect(remapped.nextStepIds).toEqual([second]);
  });
});
