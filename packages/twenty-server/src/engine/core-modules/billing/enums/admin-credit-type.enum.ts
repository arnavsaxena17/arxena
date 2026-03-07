/* @license Enterprise */

import { registerEnumType } from '@nestjs/graphql';

export enum AdminCreditType {
  ORG_CHART = 'org_chart',
  EMAIL_CONTACT = 'email_contact',
  PHONE_CONTACT = 'phone_contact',
}

registerEnumType(AdminCreditType, {
  name: 'AdminCreditType',
  description: 'Credit type for admin adjust workspace credits',
});
