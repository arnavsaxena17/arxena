export type FreeTrialSource =
  | 'homepage_hero'
  | 'header'
  | 'header_mobile'
  | 'org_chart_banner'
  | 'org_chart_node_modal';

export type FreeTrialOrgChartContext = {
  companyName?: string;
  selectedCountry?: string;
  selectedFunctionRoot?: string;
  nodeHeadline?: string;
};

export type FreeTrialLeadPayload = {
  name: string;
  email: string;
  company: string;
  source: FreeTrialSource;
  orgChartContext?: FreeTrialOrgChartContext;
};
