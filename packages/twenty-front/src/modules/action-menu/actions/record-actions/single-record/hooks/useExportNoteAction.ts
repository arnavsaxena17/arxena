import { useSelectedRecordId } from '@/action-menu/actions/record-actions/single-record/hooks/useSelectedRecordId';
import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { recordStoreFamilyState } from '@/object-record/record-store/states/recordStoreFamilyState';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { useRecoilValue } from 'recoil';
import { isDefined } from 'twenty-shared';
import { FeatureFlagKey } from '~/generated/graphql';

export const useExportNoteAction: ActionHookWithObjectMetadataItem = ({
  objectMetadataItem,
}) => {
  const recordId = useSelectedRecordId();

  const selectedRecord = useRecoilValue(recordStoreFamilyState(recordId || '00000000-0000-0000-0000-000000000000'));

  const filename = `${(selectedRecord?.title || 'Untitled Note').replace(/[<>:"/\\|?*]/g, '-')}`;

  const isNoteOrTask =
    objectMetadataItem?.nameSingular === CoreObjectNameSingular.Note ||
    objectMetadataItem?.nameSingular === CoreObjectNameSingular.Task;

  const shouldBeRegistered =
    isDefined(objectMetadataItem) && 
    isDefined(recordId) && 
    isDefined(selectedRecord) && 
    isNoteOrTask;

  const isRichTextV2Enabled = useIsFeatureEnabled(
    FeatureFlagKey.IsRichTextV2Enabled,
  );

  const onClick = async () => {
    if (!shouldBeRegistered || !recordId || !selectedRecord?.body) {
      return;
    }

    const initialBody = isRichTextV2Enabled
      ? selectedRecord.bodyV2?.blocknote
      : selectedRecord.body;

    let parsedBody = [];

    // TODO: Remove this once we have removed the old rich text
    try {
      parsedBody = JSON.parse(initialBody);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(
        `Failed to parse body for record ${recordId}, for rich text version ${isRichTextV2Enabled ? 'v2' : 'v1'}`,
      );
      // eslint-disable-next-line no-console
      console.warn(initialBody);
    }

    const { BlockNoteEditor } = await import('@blocknote/core');

    const editor = BlockNoteEditor.create({
      initialContent: parsedBody,
    });

    const { exportBlockNoteEditorToPdf } = await import(
      '@/action-menu/actions/record-actions/single-record/utils/exportBlockNoteEditorToPdf'
    );

    await exportBlockNoteEditorToPdf(editor, filename);

    // TODO later: implement DOCX export
    // const { exportBlockNoteEditorToDocx } = await import(
    //   '@/action-menu/actions/record-actions/single-record/utils/exportBlockNoteEditorToDocx'
    // );
    // await exportBlockNoteEditorToDocx(editor, filename);
  };

  return {
    shouldBeRegistered,
    onClick,
  };
};
