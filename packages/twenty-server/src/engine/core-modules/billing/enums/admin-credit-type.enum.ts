/* @license Enterprise */

import { registerEnumType } from '@nestjs/graphql';

export enum AdminCreditType {
  ORG_CHART = 'org_chart',
  REVEAL = 'reveal',
}

registerEnumType(AdminCreditType, {
  name: 'AdminCreditType',
  description: 'Credit type for admin adjust workspace credits',
});
