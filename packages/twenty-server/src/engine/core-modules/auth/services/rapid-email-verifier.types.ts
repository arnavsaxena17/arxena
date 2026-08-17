export type RapidEmailVerifierValidations = {
  syntax: boolean;
  domain_exists: boolean;
  mx_records: boolean;
  mailbox_exists: boolean;
  is_disposable: boolean;
  is_role_based: boolean;
};

export type RapidEmailVerifierResponse = {
  email: string;
  validations: RapidEmailVerifierValidations;
  score: number;
  status: string;
  typoSuggestion?: string;
  aliasOf?: string;
};
