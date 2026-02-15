import { gql } from '@apollo/client';

export const CREATE_RAZORPAY_ORDER_FOR_CREDITS = gql`
  mutation CreateRazorpayOrderForCredits($creditPackKey: String!, $currency: String) {
    createRazorpayOrderForCredits(creditPackKey: $creditPackKey, currency: $currency) {
      orderId
      amount
      currency
      keyId
      creditPackKey
      credits
    }
  }
`;
