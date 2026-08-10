export type BrowsingContextType =
  | {
      type: 'recordPage';
      objectNameSingular: string;
      recordId: string;
      pageLayoutId?: string;
      activeTabId?: string | null;
    }
  | {
      type: 'listView';
      objectNameSingular: string;
      viewId: string;
      viewName: string;
      filterDescriptions: string[];
    }
  | {
      type: 'gtmCommand';
      projectId: string | null;
      projectName: string | null;
      gtmRunKey: string | null;
      outreachWorkflowId: string | null;
      outreachSendMode: string;
      phase: string | null;
      selectedCompanyId: string | null;
      selectedPersonId: string | null;
      icpName: string | null;
      icpSpecSummary: string | null;
      linkedinConnected: boolean;
      gmailConnected: boolean;
      whatsappConnected: boolean;
    };
