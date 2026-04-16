import { gql } from '@apollo/client';

export const DELETE_ONE_ROLE = gql`
  mutation DeleteOneRole($roleId: String!) {
    deleteOneRole(roleId: $roleId)
  }
`;
