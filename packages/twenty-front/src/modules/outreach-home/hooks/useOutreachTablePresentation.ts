import { useCallback, useEffect, useRef, useState } from 'react';

import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import {
  type OutreachColumnFilter,
  type OutreachTableColumnLayout,
  type OutreachTableKey,
  readStoredOutreachColumnFilters,
  readStoredOutreachTableLayout,
  writeStoredOutreachColumnFilters,
  writeStoredOutreachTableLayout,
} from '@/outreach-home/utils/outreach-table-layout.util';

export const useOutreachTablePresentation = (
  projectId: string | null | undefined,
  tableKey: OutreachTableKey,
) => {
  const { updateOneRecord } = useUpdateOneRecord();
  const [columnLayout, setColumnLayout] = useState<
    OutreachTableColumnLayout[] | null
  >(null);
  const [columnFilters, setColumnFilters] = useState<OutreachColumnFilter[]>(
    [],
  );
  const saveTimerRef = useRef<number | null>(null);
  const serverSaveDisabledRef = useRef(false);

  useEffect(() => {
    if (!projectId) {
      setColumnLayout(null);
      setColumnFilters([]);
      return;
    }

    const storedLayout = readStoredOutreachTableLayout(projectId)[tableKey];

    setColumnLayout(storedLayout.length > 0 ? storedLayout : null);
    setColumnFilters(readStoredOutreachColumnFilters(projectId, tableKey));
  }, [projectId, tableKey]);

  useEffect(
    () => () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    },
    [],
  );

  const persistLayout = useCallback(
    (nextLayout: OutreachTableColumnLayout[]) => {
      setColumnLayout(nextLayout);

      if (!projectId) {
        return;
      }

      const document = readStoredOutreachTableLayout(projectId);
      document[tableKey] = nextLayout;
      writeStoredOutreachTableLayout(projectId, document);

      if (serverSaveDisabledRef.current) {
        return;
      }

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = window.setTimeout(() => {
        void updateOneRecord({
          objectNameSingular: 'project',
          idToUpdate: projectId,
          updateOneRecordInput: {
            outreachTableLayout: document,
          },
        }).catch(() => {
          serverSaveDisabledRef.current = true;
        });
      }, 400);
    },
    [projectId, tableKey, updateOneRecord],
  );

  const persistFilters = useCallback(
    (nextFilters: OutreachColumnFilter[]) => {
      setColumnFilters(nextFilters);

      if (projectId) {
        writeStoredOutreachColumnFilters(projectId, tableKey, nextFilters);
      }
    },
    [projectId, tableKey],
  );

  const clearColumnFilters = useCallback(() => {
    persistFilters([]);
  }, [persistFilters]);

  return {
    columnLayout,
    persistLayout,
    columnFilters,
    persistFilters,
    clearColumnFilters,
  };
};
