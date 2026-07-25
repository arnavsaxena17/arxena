import { gql } from '@apollo/client';

export const REQUEST_INVOICE_FOR_CREDITS = gql`
  mutation RequestInvoiceForCredits($input: RequestInvoiceForCreditsInput!) {
    requestInvoiceForCredits(input: $input) {
      success
    }
  }
`;
