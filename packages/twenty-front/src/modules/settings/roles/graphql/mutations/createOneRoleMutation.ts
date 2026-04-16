import { gql } from '@apollo/client';

import { ROLE_FRAGMENT } from '@/settings/roles/graphql/fragments/roleFragment';

export const CREATE_ONE_ROLE = gql`
  ${ROLE_FRAGMENT}
  mutation CreateOneRole($createRoleInput: CreateRoleInput!) {
    createOneRole(createRoleInput: $createRoleInput) {
      ...RoleFragment
    }
  }
`;
