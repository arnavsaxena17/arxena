import { gql } from '@apollo/client';

import { ROLE_FRAGMENT } from '@/settings/roles/graphql/fragments/roleFragment';

export const UPDATE_ONE_ROLE = gql`
  ${ROLE_FRAGMENT}
  mutation UpdateOneRole($updateRoleInput: UpdateRoleInput!) {
    updateOneRole(updateRoleInput: $updateRoleInput) {
      ...RoleFragment
    }
  }
`;
