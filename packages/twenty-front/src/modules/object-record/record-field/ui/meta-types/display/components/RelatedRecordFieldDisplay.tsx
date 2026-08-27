import { objectMetadataItemFamilySelector } from '@/object-metadata/states/objectMetadataItemFamilySelector';
import { getLinkToShowPage } from '@/object-metadata/utils/getLinkToShowPage';
import { FieldContext } from '@/object-record/record-field/ui/contexts/FieldContext';
import { extractRelatedRecordLabelFromWorkflowRunName } from '@/object-record/record-field/ui/meta-types/display/utils/extractRelatedRecordLabelFromWorkflowRunName';
import { recordIndexOpenRecordInState } from '@/object-record/record-index/states/recordIndexOpenRecordInState';
import { recordStoreFamilyState } from '@/object-record/record-store/states/recordStoreFamilyState';
import { canOpenObjectInSidePanel } from '@/object-record/utils/canOpenObjectInSidePanel';
import { useOpenRecordInSidePanel } from '@/side-panel/hooks/useOpenRecordInSidePanel';
import { TextDisplay } from '@/ui/field/display/components/TextDisplay';
import { useAtomFamilySelectorValue } from '@/ui/utilities/state/jotai/hooks/useAtomFamilySelectorValue';
import { useAtomFamilyStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomFamilyStateValue';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { t } from '@lingui/core/macro';
import { type MouseEvent, useContext } from 'react';
import { isDefined } from 'twenty-shared/utils';
import {
  AvatarOrIcon,
  Chip,
  ChipVariant,
  LinkChip,
} from 'twenty-ui/data-display';
import { useIcons } from 'twenty-ui/icon';
import { ViewOpenRecordIn } from '~/generated-metadata/graphql';

const readNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

export const RelatedRecordFieldDisplay = () => {
  const { recordId, disableChipClick, triggerEvent, maxWidth } =
    useContext(FieldContext);
  const record = useAtomFamilyStateValue(recordStoreFamilyState, recordId);

  const relatedRecordId = readNonEmptyString(record?.relatedRecordId);
  const relatedObjectName = readNonEmptyString(record?.relatedObjectName);

  const objectMetadataItem = useAtomFamilySelectorValue(
    objectMetadataItemFamilySelector,
    {
      objectName: relatedObjectName ?? '',
      objectNameType: 'singular',
    },
  );

  const { openRecordInSidePanel } = useOpenRecordInSidePanel();
  const recordIndexOpenRecordIn = useAtomStateValue(
    recordIndexOpenRecordInState,
  );
  const { getIcon } = useIcons();

  if (!isDefined(relatedRecordId) && !isDefined(relatedObjectName)) {
    return null;
  }

  if (!isDefined(relatedRecordId) || !isDefined(relatedObjectName)) {
    return <TextDisplay text={relatedRecordId ?? relatedObjectName ?? ''} />;
  }

  const displayName =
    extractRelatedRecordLabelFromWorkflowRunName(record?.name) ??
    objectMetadataItem?.labelSingular ??
    relatedObjectName;

  const Icon = isDefined(objectMetadataItem?.icon)
    ? getIcon(objectMetadataItem.icon)
    : undefined;

  const leftComponent = (
    <AvatarOrIcon
      placeholder={displayName}
      placeholderColorSeed={relatedRecordId}
      avatarType="rounded"
      Icon={Icon}
    />
  );

  if (disableChipClick === true) {
    return (
      <Chip
        maxWidth={maxWidth}
        label={displayName}
        emptyLabel={t`Untitled`}
        variant={ChipVariant.Transparent}
        leftComponent={leftComponent}
      />
    );
  }

  const canOpenInSidePanel = canOpenObjectInSidePanel(relatedObjectName);
  const isSidePanelViewOpenRecordIn =
    recordIndexOpenRecordIn === ViewOpenRecordIn.SIDE_PANEL &&
    canOpenInSidePanel;

  const handleClick = isSidePanelViewOpenRecordIn
    ? (_event: MouseEvent<HTMLElement>) => {
        openRecordInSidePanel({
          recordId: relatedRecordId,
          objectNameSingular: relatedObjectName,
        });
      }
    : undefined;

  return (
    <LinkChip
      maxWidth={maxWidth}
      label={displayName}
      emptyLabel={t`Untitled`}
      variant={ChipVariant.Highlighted}
      to={getLinkToShowPage(relatedObjectName, { id: relatedRecordId })}
      onClick={handleClick}
      triggerEvent={triggerEvent}
      leftComponent={leftComponent}
    />
  );
};
