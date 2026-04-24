import * as go from 'gojs';
import type React from 'react';

import { applyZoomAroundNode } from './zoomAndRoot';

export const focusResultAtIndex = ({
  index,
  getDiagram,
  searchResultsKeysRef,
  currentResultIndexRef,
}: {
  index: number;
  getDiagram: () => go.Diagram | null;
  searchResultsKeysRef: React.MutableRefObject<go.Key[]>;
  currentResultIndexRef: React.MutableRefObject<number>;
}): void => {
  const diagram = getDiagram();
  if (!diagram) return;

  const keys = searchResultsKeysRef.current;
  if (!keys.length) return;

  const safeIndex = ((index % keys.length) + keys.length) % keys.length;
  const key = keys[safeIndex];
  const part = diagram.findPartForKey(key);
  if (!part || !(part instanceof go.Node)) return;

  applyZoomAroundNode(diagram, part);
  currentResultIndexRef.current = safeIndex;
};

export const performSearch = ({
  keyword,
  getDiagram,
  searchResultsKeysRef,
  currentResultIndexRef,
}: {
  keyword: string;
  getDiagram: () => go.Diagram | null;
  searchResultsKeysRef: React.MutableRefObject<go.Key[]>;
  currentResultIndexRef: React.MutableRefObject<number>;
}): number => {
  const diagram = getDiagram();
  if (!diagram) return 0;

  diagram.startTransaction('highlight search');
  diagram.clearHighlighteds();

  const trimmed = keyword.trim();
  if (!trimmed) {
    searchResultsKeysRef.current = [];
    currentResultIndexRef.current = 0;
    diagram.commitTransaction('highlight search');
    diagram.commandHandler.zoomToFit();
    return 0;
  }

  const regex = new RegExp(trimmed, 'i');
  const examples: go.ObjectData[] = [{ headline: regex }, { country: regex }];
  for (let i = 0; i <= 297; i += 1) {
    examples.push({ [`name_${i}`]: regex }, { [`title_${i}`]: regex });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = (diagram as any).findNodesByExample.apply(
    diagram,
    examples,
  ) as go.Iterator<go.Node>;

  const keys: go.Key[] = [];
  results.each((item) => keys.push(item.data.key));
  searchResultsKeysRef.current = keys;
  currentResultIndexRef.current = 0;

  diagram.highlightCollection(results);

  const first = results.first();
  if (first) {
    applyZoomAroundNode(diagram, first);
  } else {
    diagram.commandHandler.zoomToFit();
  }

  diagram.commitTransaction('highlight search');
  return keys.length;
};

export const clearSearch = ({
  getDiagram,
  searchResultsKeysRef,
  currentResultIndexRef,
}: {
  getDiagram: () => go.Diagram | null;
  searchResultsKeysRef: React.MutableRefObject<go.Key[]>;
  currentResultIndexRef: React.MutableRefObject<number>;
}): void => {
  const diagram = getDiagram();
  if (!diagram) return;

  searchResultsKeysRef.current = [];
  currentResultIndexRef.current = 0;
  diagram.startTransaction('highlight search');
  diagram.clearHighlighteds();
  diagram.commitTransaction('highlight search');
  diagram.commandHandler.zoomToFit();
};

