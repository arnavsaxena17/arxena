export type OutreachSenderCollateralFile = {
  fileId: string;
  fileName: string;
  mimeType?: string;
};

export type OutreachSenderProfile = {
  targetTitles: string[];
  locations: string[];
  brief: string;
  collateralFiles?: OutreachSenderCollateralFile[];
};
