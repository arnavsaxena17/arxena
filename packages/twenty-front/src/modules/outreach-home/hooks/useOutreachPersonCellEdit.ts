import axios from 'axios';
import { useCallback } from 'react';
import { toSnakeCaseKey } from 'twenty-shared/utils';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { type OutreachRecordTableColumn } from '@/outreach-home/components/record-table/OutreachRecordTable';
import { type OutreachPersonRow } from '@/outreach-home/types/outreach-home.types';
import { readRawJsonCell } from '@/outreach-home/utils/outreach-table-layout.util';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

const OTHER_FIELDS_PREFIX = 'otherFields.';
// AI column key from OUTREACH_SAMPLE_MESSAGE_COLUMN_KEY (server)
const SAMPLE_LINKEDIN_MESSAGE_KEY = 'sampleLinkedinMessage';

// Table column id -> field name understood by candidate-sourcing
// /update-candidate-field (writes to Person)
const SERVER_FIELD_BY_COLUMN_ID: Record<string, string> = {
  title: 'jobTitle',
  company: 'jobCompanyName',
  location: 'locationName',
  linkedin: 'linkedinUrl',
};

const getPersonFieldValue = (
  person: OutreachPersonRow,
  columnId: string,
): string => {
  switch (columnId) {
    case 'title':
      return person.title ?? '';
    case 'company':
      return person.companyName ?? '';
    case 'location':
      return person.locationName ?? '';
    case 'linkedin':
      return person.linkedinUrl ?? '';
    default:
      return readRawJsonCell(person, columnId);
  }
};

const isEditableColumnId = (columnId: string): boolean => {
  if (columnId in SERVER_FIELD_BY_COLUMN_ID) {
    return true;
  }

  if (!columnId.startsWith(OTHER_FIELDS_PREFIX)) {
    return false;
  }

  // Snake_case enrichment keys write as-is; the sample LinkedIn AI column is
  // camelCase and is editable so drafts can be cleared or tweaked by hand.
  const key = columnId.slice(OTHER_FIELDS_PREFIX.length);

  return (
    key.length > 0 &&
    (toSnakeCaseKey(key) === key || key === SAMPLE_LINKEDIN_MESSAGE_KEY)
  );
};

// Keep numbers/booleans typed when the existing value was one
const coerceLikePreviousValue = (
  person: OutreachPersonRow,
  key: string,
  draft: string,
): string | number | boolean => {
  const bag = person.otherFields;
  const parsedBag =
    typeof bag === 'string'
      ? (() => {
          try {
            return JSON.parse(bag) as Record<string, unknown>;
          } catch {
            return {};
          }
        })()
      : ((bag ?? {}) as Record<string, unknown>);
  const previous = parsedBag[key];
  const trimmed = draft.trim();

  if (typeof previous === 'number' && /^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  if (typeof previous === 'boolean') {
    return ['yes', 'true'].includes(trimmed.toLowerCase());
  }

  return draft;
};

const patchEphemeralPerson = (
  person: OutreachPersonRow,
  columnId: string,
  value: string,
): OutreachPersonRow => {
  switch (columnId) {
    case 'title':
      return { ...person, title: value };
    case 'company':
      return { ...person, companyName: value };
    case 'location':
      return { ...person, locationName: value };
    case 'linkedin':
      return { ...person, linkedinUrl: value };
    default: {
      const key = columnId.slice(OTHER_FIELDS_PREFIX.length);
      const existing =
        typeof person.otherFields === 'string'
          ? (JSON.parse(person.otherFields) as Record<string, unknown>)
          : ((person.otherFields ?? {}) as Record<string, unknown>);
      const aiColumns =
        typeof existing.aiColumns === 'object' && existing.aiColumns !== null
          ? (existing.aiColumns as Record<string, unknown>)
          : {};
      const previousMeta = aiColumns[key];

      return {
        ...person,
        otherFields: {
          ...existing,
          [key]: coerceLikePreviousValue(person, key, value),
          // Clear "Failed" when the user edits / clears an AI column cell
          ...(typeof previousMeta === 'object' &&
          previousMeta !== null &&
          !Array.isArray(previousMeta)
            ? {
                aiColumns: {
                  ...aiColumns,
                  [key]: {
                    ...(previousMeta as Record<string, unknown>),
                    status: 'ok',
                  },
                },
              }
            : {}),
        },
      };
    }
  }
};

const buildSampleMessagePatchValues = (
  person: OutreachPersonRow,
  value: string,
): Record<string, unknown> => {
  const existing =
    typeof person.otherFields === 'string'
      ? (JSON.parse(person.otherFields) as Record<string, unknown>)
      : ((person.otherFields ?? {}) as Record<string, unknown>);
  const aiColumns =
    typeof existing.aiColumns === 'object' && existing.aiColumns !== null
      ? (existing.aiColumns as Record<string, unknown>)
      : {};
  const previousMeta = aiColumns[SAMPLE_LINKEDIN_MESSAGE_KEY];
  const nextValue = coerceLikePreviousValue(
    person,
    SAMPLE_LINKEDIN_MESSAGE_KEY,
    value,
  );

  return {
    [SAMPLE_LINKEDIN_MESSAGE_KEY]: nextValue,
    ...(typeof previousMeta === 'object' &&
    previousMeta !== null &&
    !Array.isArray(previousMeta)
      ? {
          aiColumns: {
            [SAMPLE_LINKEDIN_MESSAGE_KEY]: {
              ...(previousMeta as Record<string, unknown>),
              status: 'ok',
            },
          },
        }
      : {}),
  };
};

export const useOutreachPersonCellEdit = ({
  projectId,
  onRefresh,
  updateEphemeralPerson,
}: {
  projectId?: string | null;
  onRefresh?: () => Promise<void>;
  updateEphemeralPerson?: (
    personId: string,
    applyPatch: (person: OutreachPersonRow) => OutreachPersonRow,
  ) => Promise<void>;
}) => {
  const [tokenPair] = useAtomState(tokenPairState);
  const accessToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;
  const { enqueueErrorSnackBar } = useSnackBar();

  const savePersonCell = useCallback(
    async (person: OutreachPersonRow, columnId: string, value: string) => {
      try {
        // Rows without a candidate only exist in the Redis people cache
        if (!person.candidateId) {
          if (!updateEphemeralPerson) {
            throw new Error('Editing is not available for this row');
          }

          await updateEphemeralPerson(person.id, (current) =>
            patchEphemeralPerson(current, columnId, value),
          );

          return;
        }

        if (!accessToken) {
          throw new Error('Not signed in');
        }

        const headers = { Authorization: `Bearer ${accessToken}` };
        const isOtherField = columnId.startsWith(OTHER_FIELDS_PREFIX);
        const key = columnId.slice(OTHER_FIELDS_PREFIX.length);

        // AI sample-message column is camelCase; candidate-sourcing
        // update-candidate-field-value snake_cases keys, so write via the
        // tab path that preserves camelCase.
        if (isOtherField && key === SAMPLE_LINKEDIN_MESSAGE_KEY) {
          if (!projectId) {
            throw new Error('Open an Outreach project first');
          }

          await axios.post(
            `${REACT_APP_SERVER_BASE_URL}/outreach-command/tab/patch-other-fields`,
            {
              projectId,
              tab: 'people',
              rowId: person.candidateId,
              values: buildSampleMessagePatchValues(person, value),
            },
            { headers },
          );
          await onRefresh?.();

          return;
        }

        const response = isOtherField
          ? await axios.post<{ status?: string; error?: string }>(
              `${REACT_APP_SERVER_BASE_URL}/candidate-sourcing/update-candidate-field-value`,
              {
                candidateId: person.candidateId,
                fieldName: key,
                value: coerceLikePreviousValue(person, key, value),
              },
              { headers },
            )
          : await axios.post<{ status?: string; error?: string }>(
              `${REACT_APP_SERVER_BASE_URL}/candidate-sourcing/update-candidate-field`,
              {
                candidateId: person.candidateId,
                personId: person.id,
                fieldName: SERVER_FIELD_BY_COLUMN_ID[columnId],
                value,
              },
              { headers },
            );

        if (response.data?.status === 'Failed') {
          throw new Error(response.data.error ?? 'Update failed');
        }

        await onRefresh?.();
      } catch (error) {
        enqueueErrorSnackBar({
          message: `Failed to save change: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        });
        await onRefresh?.();
      }
    },
    [
      accessToken,
      enqueueErrorSnackBar,
      onRefresh,
      projectId,
      updateEphemeralPerson,
    ],
  );

  const withEditableCells = useCallback(
    (
      columns: OutreachRecordTableColumn<OutreachPersonRow>[],
    ): OutreachRecordTableColumn<OutreachPersonRow>[] =>
      columns.map((column) =>
        isEditableColumnId(column.id)
          ? {
              ...column,
              edit: {
                getValue: (person) => getPersonFieldValue(person, column.id),
                onSave: (person, value) =>
                  savePersonCell(person, column.id, value),
              },
            }
          : column,
      ),
    [savePersonCell],
  );

  return { withEditableCells };
};
