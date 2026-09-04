import * as go from 'gojs';
import type React from 'react';

import { applyZoomAroundNode } from './zoomAndRoot';

const MAX_PERSON_SLOT_INDEX = 297;

export const normalizeSearchKeywords = (
  keyword: string | readonly string[],
): string[] => {
  const terms = Array.isArray(keyword) ? keyword : [keyword];

  return terms.map((term) => term.trim()).filter((term) => term.length > 0);
};

const buildSearchExamples = (regex: RegExp): go.ObjectData[] => {
  const examples: go.ObjectData[] = [
    { headline: regex },
    { country: regex },
    { std_function: regex },
    { std_function_root: regex },
    { std_grade: regex },
  ];

  for (let slotIndex = 0; slotIndex <= MAX_PERSON_SLOT_INDEX; slotIndex += 1) {
    examples.push(
      { [`name_${slotIndex}`]: regex },
      { [`title_${slotIndex}`]: regex },
    );
  }

  return examples;
};

const collectNodesByExample = (
  diagram: go.Diagram,
  regex: RegExp,
): go.Node[] => {
  const examples = buildSearchExamples(regex);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = (diagram as any).findNodesByExample.apply(
    diagram,
    examples,
  ) as go.Iterator<go.Node>;

  const nodes: go.Node[] = [];
  results.each((node) => nodes.push(node));

  return nodes;
};

const commitHighlightedNodes = ({
  diagram,
  nodes,
  searchResultsKeysRef,
  currentResultIndexRef,
}: {
  diagram: go.Diagram;
  nodes: go.Node[];
  searchResultsKeysRef: React.MutableRefObject<go.Key[]>;
  currentResultIndexRef: React.MutableRefObject<number>;
}): number => {
  const seenKeys = new Set<string>();
  const uniqueNodes: go.Node[] = [];

  for (const node of nodes) {
    const key = node.data?.key;
    const keyToken = String(key);

    if (seenKeys.has(keyToken)) {
      continue;
    }

    seenKeys.add(keyToken);
    uniqueNodes.push(node);
  }

  const keys = uniqueNodes.map((node) => node.data.key as go.Key);
  searchResultsKeysRef.current = keys;
  currentResultIndexRef.current = 0;

  diagram.highlightCollection(uniqueNodes);

  const first = uniqueNodes[0];
  if (first) {
    applyZoomAroundNode(diagram, first);
  } else {
    diagram.commandHandler.zoomToFit();
  }

  return keys.length;
};

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
  keyword: string | readonly string[];
  getDiagram: () => go.Diagram | null;
  searchResultsKeysRef: React.MutableRefObject<go.Key[]>;
  currentResultIndexRef: React.MutableRefObject<number>;
}): number => {
  const diagram = getDiagram();
  if (!diagram) return 0;

  diagram.startTransaction('highlight search');
  diagram.clearHighlighteds();

  const terms = normalizeSearchKeywords(keyword);
  if (terms.length === 0) {
    searchResultsKeysRef.current = [];
    currentResultIndexRef.current = 0;
    diagram.commitTransaction('highlight search');
    diagram.commandHandler.zoomToFit();
    return 0;
  }

  const matchedNodes: go.Node[] = [];
  for (const term of terms) {
    matchedNodes.push(...collectNodesByExample(diagram, new RegExp(term, 'i')));
  }

  const count = commitHighlightedNodes({
    diagram,
    nodes: matchedNodes,
    searchResultsKeysRef,
    currentResultIndexRef,
  });

  diagram.commitTransaction('highlight search');
  return count;
};

export const highlightKeys = ({
  keys,
  getDiagram,
  searchResultsKeysRef,
  currentResultIndexRef,
}: {
  keys: ReadonlyArray<string | number>;
  getDiagram: () => go.Diagram | null;
  searchResultsKeysRef: React.MutableRefObject<go.Key[]>;
  currentResultIndexRef: React.MutableRefObject<number>;
}): number => {
  const diagram = getDiagram();
  if (!diagram) return 0;

  diagram.startTransaction('highlight search');
  diagram.clearHighlighteds();

  const nodes: go.Node[] = [];
  for (const key of keys) {
    const part = diagram.findPartForKey(key);
    if (part instanceof go.Node) {
      nodes.push(part);
    }
  }

  const count = commitHighlightedNodes({
    diagram,
    nodes,
    searchResultsKeysRef,
    currentResultIndexRef,
  });

  diagram.commitTransaction('highlight search');
  return count;
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
