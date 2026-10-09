import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type OutreachColumnFilter,
} from '@/outreach-home/utils/outreach-table-layout.util';
import {
  type OutreachTableTab,
  type OutreachTableView,
} from '@/outreach-home/constants/outreach-cache-realtime.constants';
import {
  readDismissedOutreachTableView,
  writeDismissedOutreachTableView,
} from '@/outreach-home/utils/outreach-table-view';

export type OutreachExternalSort = {
  // An empty columnId clears the sort
  columnId: string;
  direction: 'asc' | 'desc';
  key: string;
};

// Applies the filters and sort the agent set for the project to this table
// and lets the viewer dismiss them locally. A view the viewer cleared stays
// cleared after a reload; a newer view from the agent shows up again.
export const useOutreachAiTableView = ({
  projectId,
  tab,
  view,
  persistFilters,
}: {
  projectId: string | null | undefined;
  tab: OutreachTableTab;
  view: OutreachTableView | null | undefined;
  persistFilters: (filters: OutreachColumnFilter[]) => void;
}) => {
  const [externalSort, setExternalSort] = useState<OutreachExternalSort | null>(
    null,
  );
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);
  const persistFiltersRef = useRef(persistFilters);

  persistFiltersRef.current = persistFilters;

  const updatedAt = view?.updatedAt;

  useEffect(() => {
    if (!projectId || !view) {
      return;
    }

    const dismissed = readDismissedOutreachTableView(projectId, tab);

    setDismissedAt(dismissed);

    if (dismissed === view.updatedAt) {
      return;
    }

    persistFiltersRef.current(view.filters);
    setExternalSort({
      columnId: view.sort?.columnId ?? '',
      direction: view.sort?.direction ?? 'asc',
      key: view.updatedAt,
    });
    // view is keyed by updatedAt: a new apply from the agent re-runs this
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, tab, updatedAt]);

  const clear = useCallback(() => {
    persistFiltersRef.current([]);
    setExternalSort({
      columnId: '',
      direction: 'asc',
      key: `clear-${Date.now()}`,
    });

    if (projectId && view) {
      writeDismissedOutreachTableView(projectId, tab, view.updatedAt);
      setDismissedAt(view.updatedAt);
    }
  }, [projectId, tab, view]);

  return {
    externalSort,
    activeView: view && dismissedAt !== view.updatedAt ? view : null,
    clearAiView: clear,
  };
};
