/* @license Enterprise */

import { registerEnumType } from '@nestjs/graphql';

export enum CreditFulfillmentMode {
  RESET = 'reset',
  ADD = 'add',
  SPLIT = 'split',
}

registerEnumType(CreditFulfillmentMode, {
  name: 'CreditFulfillmentMode',
  description:
    'How subscription cycle grants apply maps/reveals/AI (default reset)',
});
