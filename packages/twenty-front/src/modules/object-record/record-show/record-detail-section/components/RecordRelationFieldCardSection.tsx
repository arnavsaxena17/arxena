import { useCallback, useContext } from 'react';
import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import qs from 'qs';
import { useRecoilValue } from 'recoil';

import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { FieldContext } from '@/object-record/record-field/contexts/FieldContext';
import { usePersistField } from '@/object-record/record-field/hooks/usePersistField';
import { FieldRelationMetadata } from '@/object-record/record-field/types/FieldMetadata';
import { RecordDetailSectionHeader } from '@/object-record/record-show/record-detail-section/components/RecordDetailSectionHeader';
import { RecordRelationFieldCardContent } from '@/object-record/record-show/record-detail-section/components/RecordRelationFieldCardContent';
import { recordStoreFamilyState } from '@/object-record/record-store/states/recordStoreFamilyState';
import { recordStoreFamilySelector } from '@/object-record/record-store/states/selectors/recordStoreFamilySelector';
import { SingleEntitySelectMenuItemsWithSearch } from '@/object-record/relation-picker/components/SingleEntitySelectMenuItemsWithSearch';
import { useRelationPicker } from '@/object-record/relation-picker/hooks/useRelationPicker';
import { RelationPickerScope } from '@/object-record/relation-picker/scopes/RelationPickerScope';
import { EntityForSelect } from '@/object-record/relation-picker/types/EntityForSelect';
import { ObjectRecord } from '@/object-record/types/ObjectRecord';
import { IconForbid, IconPencil, IconPlus } from '@/ui/display/icon';
import { useIcons } from '@/ui/display/icon/hooks/useIcons';
import { LightIconButton } from '@/ui/input/button/components/LightIconButton';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { useDropdown } from '@/ui/layout/dropdown/hooks/useDropdown';
import { DropdownScope } from '@/ui/layout/dropdown/scopes/DropdownScope';
import { Section } from '@/ui/layout/section/components/Section';
import { FilterQueryParams } from '@/views/hooks/internal/useFiltersFromQueryParams';
import { ViewFilterOperand } from '@/views/types/ViewFilterOperand';

const StyledAddDropdown = styled(Dropdown)`
  margin-left: auto;
`;

const StyledCardNoContent = styled.div`
  color: ${({ theme }) => theme.font.color.light};
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing(2)};
  display: flex;
  height: ${({ theme }) => theme.spacing(10)};
  text-transform: capitalize;
`;

const StyledCard = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  overflow: hidden;
`;

const StyledSection = styled(Section)`
  padding: ${({ theme }) => theme.spacing(3)};
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
  width: unset;
`;

export const RecordRelationFieldCardSection = () => {
  const theme = useTheme();

  const { entityId, fieldDefinition } = useContext(FieldContext);
  const {
    fieldName,
    relationFieldMetadataId,
    relationObjectMetadataNameSingular,
    relationType,
  } = fieldDefinition.metadata as FieldRelationMetadata;
  const record = useRecoilValue(recordStoreFamilyState(entityId));

  const {
    labelIdentifierFieldMetadata: relationLabelIdentifierFieldMetadata,
    objectMetadataItem: relationObjectMetadataItem,
  } = useObjectMetadataItem({
    objectNameSingular: relationObjectMetadataNameSingular,
  });

  const relationFieldMetadataItem = relationObjectMetadataItem.fields.find(
    ({ id }) => id === relationFieldMetadataId,
  );

  const fieldValue = useRecoilValue<
    ({ id: string } & Record<string, any>) | null
  >(recordStoreFamilySelector({ recordId: entityId, fieldName }));

  const isToOneObject = relationType === 'TO_ONE_OBJECT';
  const isFromManyObjects = relationType === 'FROM_MANY_OBJECTS';

  const relationRecords: ObjectRecord[] =
    fieldValue && isToOneObject
      ? [fieldValue]
      : fieldValue?.edges.map(({ node }: { node: ObjectRecord }) => node) ?? [];
  const relationRecordIds = relationRecords.map(({ id }) => id);

  const dropdownId = `record-field-card-relation-picker-${fieldDefinition.label}`;

  const { closeDropdown, isDropdownOpen } = useDropdown(dropdownId);

  const { setRelationPickerSearchFilter } = useRelationPicker({
    relationPickerScopeId: dropdownId,
  });

  const handleCloseRelationPickerDropdown = useCallback(() => {
    setRelationPickerSearchFilter('');
  }, [setRelationPickerSearchFilter]);

  const persistField = usePersistField();
  const { updateOneRecord: updateOneRelationRecord } = useUpdateOneRecord({
    objectNameSingular: relationObjectMetadataNameSingular,
  });

  const handleRelationPickerEntitySelected = (
    selectedRelationEntity?: EntityForSelect,
  ) => {
    closeDropdown();

    if (!selectedRelationEntity?.id || !relationFieldMetadataItem?.name) return;

    if (isToOneObject) {
      persistField(selectedRelationEntity.record);
      return;
    }

    updateOneRelationRecord({
      idToUpdate: selectedRelationEntity.id,
      updateOneRecordInput: {
        [relationFieldMetadataItem.name]: record,
      },
    });
  };

  const filterQueryParams: FilterQueryParams = {
    filter: {
      [relationFieldMetadataItem?.name || '']: {
        [ViewFilterOperand.Is]: [entityId],
      },
    },
  };
  const filterLinkHref = `/objects/${
    relationObjectMetadataItem.namePlural
  }?${qs.stringify(filterQueryParams)}`;

  const { getIcon } = useIcons();
  const Icon = getIcon(relationObjectMetadataItem.icon);

  return (
    <StyledSection>
      <RecordDetailSectionHeader
        title={fieldDefinition.label}
        link={
          isFromManyObjects
            ? {
                to: filterLinkHref,
                label: `All (${relationRecords.length})`,
              }
            : undefined
        }
        hideRightAdornmentOnMouseLeave={!isDropdownOpen}
        rightAdornment={
          <DropdownScope dropdownScopeId={dropdownId}>
            <StyledAddDropdown
              dropdownId={dropdownId}
              dropdownPlacement="right-start"
              onClose={handleCloseRelationPickerDropdown}
              clickableComponent={
                <LightIconButton
                  className="displayOnHover"
                  Icon={isToOneObject ? IconPencil : IconPlus}
                  accent="tertiary"
                />
              }
              dropdownComponents={
                <RelationPickerScope relationPickerScopeId={dropdownId}>
                  <SingleEntitySelectMenuItemsWithSearch
                    EmptyIcon={IconForbid}
                    onEntitySelected={handleRelationPickerEntitySelected}
                    selectedRelationRecordIds={relationRecordIds}
                    relationObjectNameSingular={
                      relationObjectMetadataNameSingular
                    }
                    relationPickerScopeId={dropdownId}
                  />
                </RelationPickerScope>
              }
              dropdownHotkeyScope={{
                scope: dropdownId,
              }}
            />
          </DropdownScope>
        }
      />
      {relationRecords.length === 0 && (
        <StyledCardNoContent>
          <Icon size={theme.icon.size.sm} />
          <div>No {relationObjectMetadataItem.labelSingular}</div>
        </StyledCardNoContent>
      )}
      {!!relationRecords.length && (
        <StyledCard>
          {relationRecords.slice(0, 5).map((relationRecord, index) => (
            <RecordRelationFieldCardContent
              key={`${relationRecord.id}${relationLabelIdentifierFieldMetadata?.id}`}
              divider={index < relationRecords.length - 1}
              relationRecord={relationRecord}
            />
          ))}
        </StyledCard>
      )}
    </StyledSection>
  );
};
