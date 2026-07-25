import { gql } from '@apollo/client';

export const CREATE_RAZORPAY_ORDER_FOR_CREDITS = gql`
  mutation CreateRazorpayOrderForCredits($input: CreateRazorpayOrderInput!) {
    createRazorpayOrderForCredits(input: $input) {
      orderId
      amount
      currency
      keyId
    }
  }
`;
