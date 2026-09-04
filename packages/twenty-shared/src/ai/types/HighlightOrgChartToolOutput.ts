export type HighlightOrgChartToolOutput =
  | {
      action: 'applySearch';
      searchTerms: string[];
      stdFunction?: string;
      stdFunctionRoot?: string;
      stdGrade?: string;
      nodeKeys?: Array<string | number>;
    }
  | {
      action: 'clear';
      searchTerms: [];
    };
