export type BrowsingContext =
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
      type: 'outreachCommand';
      projectId: string | null;
      projectName: string | null;
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
    }
  | {
      type: 'orgChart';
      companyId: string | null;
      companyName: string | null;
      country: string | null;
      functionRoot: string | null;
      titleQuery: string | null;
      searchTerm: string | null;
    };
