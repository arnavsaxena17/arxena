import { gql } from '@apollo/client';

export const CREDIT_TRANSACTIONS = gql`
  query CreditTransactions($limit: Int, $cursor: String) {
    creditTransactions(limit: $limit, cursor: $cursor) {
      items {
        id
        type
        creditType
        amount
        metadata
        createdAt
      }
      nextCursor
    }
  }
`;
