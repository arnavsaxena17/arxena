import { gql } from '@apollo/client';

export const ADMIN_SET_CREDIT_FULFILLMENT_MODE = gql`
  mutation AdminSetCreditFulfillmentMode(
    $input: AdminSetCreditFulfillmentModeInput!
  ) {
    adminSetCreditFulfillmentMode(input: $input)
  }
`;

export const ADMIN_GET_CREDIT_FULFILLMENT_MODE = gql`
  query AdminGetCreditFulfillmentMode($workspaceId: String!) {
    adminGetCreditFulfillmentMode(workspaceId: $workspaceId)
  }
`;
