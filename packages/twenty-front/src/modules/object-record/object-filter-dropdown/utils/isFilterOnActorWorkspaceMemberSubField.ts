import { type FieldActorValue } from '@/object-record/record-field/types/FieldMetadata';

export const isFilterOnActorWorkspaceMemberSubField = (
  subFieldName?: string | null | undefined,
) => {
  return subFieldName === ('workspaceMemberId' satisfies keyof FieldActorValue);
};
