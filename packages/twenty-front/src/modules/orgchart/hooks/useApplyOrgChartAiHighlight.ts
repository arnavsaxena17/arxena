import { useEffect, useState, type RefObject } from 'react';
import { type OrgChartDiagramHandle } from 'twenty-orgchart';
import { isDefined } from 'twenty-shared/utils';

import type { OrgChartTitleQueryResolved } from '@/orgchart/components/OrgChartTitleQueryBar';
import { orgChartAiHighlightState } from '@/orgchart/states/orgChartAiHighlightState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

export const useApplyOrgChartAiHighlight = ({
  diagramHandleRef,
  setSearchTerm,
  setSearchResultCount,
  setTitleQuery,
  setTitleQueryResolved,
  displayedNodeDataArrayLength,
}: {
  diagramHandleRef: RefObject<OrgChartDiagramHandle | null>;
  setSearchTerm: (value: string) => void;
  setSearchResultCount: (value: number | null) => void;
  setTitleQuery: (value: string) => void;
  setTitleQueryResolved: (value: OrgChartTitleQueryResolved | null) => void;
  displayedNodeDataArrayLength: number;
}) => {
  const orgChartAiHighlight = useAtomStateValue(orgChartAiHighlightState);
  const [appliedTaxonomyRequestId, setAppliedTaxonomyRequestId] = useState<
    string | null
  >(null);
  const [searchedRequestId, setSearchedRequestId] = useState<string | null>(
    null,
  );
  const [lastSearchedNodeCount, setLastSearchedNodeCount] = useState<
    number | null
  >(null);

  useEffect(() => {
    if (!isDefined(orgChartAiHighlight)) {
      return;
    }

    if (orgChartAiHighlight.action === 'clear') {
      if (searchedRequestId === orgChartAiHighlight.requestId) {
        return;
      }

      diagramHandleRef.current?.clearSearch();
      setSearchTerm('');
      setSearchResultCount(null);
      setTitleQuery('');
      setTitleQueryResolved(null);
      setAppliedTaxonomyRequestId(orgChartAiHighlight.requestId);
      setSearchedRequestId(orgChartAiHighlight.requestId);
      setLastSearchedNodeCount(displayedNodeDataArrayLength);
      return;
    }

    const hasTaxonomy =
      isDefined(orgChartAiHighlight.stdFunction) ||
      isDefined(orgChartAiHighlight.stdFunctionRoot) ||
      isDefined(orgChartAiHighlight.stdGrade);
    const hasNodeKeys =
      isDefined(orgChartAiHighlight.nodeKeys) &&
      orgChartAiHighlight.nodeKeys.length > 0;
    const nodeKeys = hasNodeKeys ? orgChartAiHighlight.nodeKeys : undefined;

    // Exact node keys take precedence over taxonomy Title Query filtering
    if (
      hasTaxonomy &&
      !hasNodeKeys &&
      appliedTaxonomyRequestId !== orgChartAiHighlight.requestId
    ) {
      const resolvedTitle =
        orgChartAiHighlight.searchTerms[0] ??
        orgChartAiHighlight.stdFunction ??
        orgChartAiHighlight.stdFunctionRoot ??
        '';

      setTitleQuery(resolvedTitle);
      setTitleQueryResolved({
        jobTitle: resolvedTitle,
        normalizedTitle: orgChartAiHighlight.searchTerms[0],
        stdFunction: orgChartAiHighlight.stdFunction,
        stdFunctionRoot: orgChartAiHighlight.stdFunctionRoot,
        stdGrade: orgChartAiHighlight.stdGrade,
      });
      setAppliedTaxonomyRequestId(orgChartAiHighlight.requestId);
      setSearchedRequestId(null);
      setLastSearchedNodeCount(null);
      return;
    }

    const handle = diagramHandleRef.current;

    if (!isDefined(handle)) {
      return;
    }

    if (
      searchedRequestId === orgChartAiHighlight.requestId &&
      lastSearchedNodeCount === displayedNodeDataArrayLength
    ) {
      return;
    }

    const searchTermsDisplay = orgChartAiHighlight.searchTerms.join(' ').trim();
    const searchQuery =
      orgChartAiHighlight.searchTerms.length > 0
        ? orgChartAiHighlight.searchTerms
        : (orgChartAiHighlight.stdFunction ??
          orgChartAiHighlight.stdFunctionRoot ??
          '');
    const count =
      isDefined(nodeKeys) && nodeKeys.length > 0
        ? handle.highlightKeys(nodeKeys)
        : handle.search(searchQuery);

    setSearchTerm(
      searchTermsDisplay ||
        (isDefined(nodeKeys) && nodeKeys.length > 0
          ? `${nodeKeys.length} nodes`
          : '') ||
        orgChartAiHighlight.stdFunction ||
        orgChartAiHighlight.stdFunctionRoot ||
        '',
    );
    setSearchResultCount(count);
    setSearchedRequestId(orgChartAiHighlight.requestId);
    setLastSearchedNodeCount(displayedNodeDataArrayLength);
  }, [
    orgChartAiHighlight,
    displayedNodeDataArrayLength,
    appliedTaxonomyRequestId,
    searchedRequestId,
    lastSearchedNodeCount,
    diagramHandleRef,
    setSearchTerm,
    setSearchResultCount,
    setTitleQuery,
    setTitleQueryResolved,
  ]);
};
