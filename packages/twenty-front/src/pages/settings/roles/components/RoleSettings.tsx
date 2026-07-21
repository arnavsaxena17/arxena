import { IconUser } from 'twenty-ui/icons';
import { Button, H2Title, IconButton, Section, Toggle } from 'twenty-ui';
import { IconX } from 'twenty-ui/icons';
import { ApolloError, useMutation } from '@apollo/client';
import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { isDefined } from 'twenty-shared';

import { DELETE_ONE_ROLE } from '@/settings/roles/graphql/mutations/deleteOneRoleMutation';
import { UPDATE_ONE_ROLE } from '@/settings/roles/graphql/mutations/updateOneRoleMutation';
import { GET_ROLES } from '@/settings/roles/graphql/queries/getRolesQuery';
import { SettingsPath } from '@/types/SettingsPath';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { IconPicker } from '@/ui/input/components/IconPicker';
import { TextArea } from '@/ui/input/components/TextArea';
import { TextInput } from '@/ui/input/components/TextInput';
import { Modal } from '@/ui/layout/modal/components/Modal';
import { Role } from '~/generated-metadata/graphql';
import { useNavigateSettings } from '~/hooks/useNavigateSettings';

const StyledInputsContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  width: 100%;
`;

const StyledInputContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const StyledToggleRow = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

const StyledActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  margin-top: ${({ theme }) => theme.spacing(4)};
`;

const StyledButtonRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  justify-content: flex-end;
`;

const StyledConfirmShell = styled.div`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  max-width: 100%;
  min-width: 0;
  width: 100%;
`;

const StyledConfirmHeader = styled.div`
  align-items: center;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  box-sizing: border-box;
  display: flex;
  flex-shrink: 0;
  gap: ${({ theme }) => theme.spacing(2)};
  justify-content: space-between;
  min-width: 0;
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledConfirmTitle = styled.h2`
  color: ${({ theme }) => theme.font.color.primary};
  flex: 1;
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  line-height: ${({ theme }) => theme.text.lineHeight.md};
  margin: 0;
  min-width: 0;
`;

const StyledConfirmBody = styled.div`
  box-sizing: border-box;
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.md};
  line-height: ${({ theme }) => theme.text.lineHeight.md};
  min-width: 0;
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledConfirmFooter = styled.div`
  align-items: center;
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
  box-sizing: border-box;
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
  justify-content: flex-end;
  padding: ${({ theme }) => theme.spacing(4)};
  width: 100%;
`;

type RoleSettingsProps = {
  role: Pick<
    Role,
    | 'id'
    | 'label'
    | 'description'
    | 'isEditable'
    | 'canUpdateAllSettings'
    | 'canReadAllObjectRecords'
    | 'canUpdateAllObjectRecords'
    | 'canSoftDeleteAllObjectRecords'
    | 'canDestroyAllObjectRecords'
  >;
  onRoleUpdated: () => void | Promise<void>;
};

const getErrorMessage = (error: ApolloError): string => {
  const graphQLError = error.graphQLErrors?.[0];
  if (isDefined(graphQLError?.message) && graphQLError.message.length > 0) {
    return graphQLError.message;
  }
  return error.message;
};

export const RoleSettings = ({ role, onRoleUpdated }: RoleSettingsProps) => {
  const { t: tMacro } = useLingui();
  const { enqueueSnackBar } = useSnackBar();
  const navigateSettings = useNavigateSettings();

  const [label, setLabel] = useState(role.label);
  const [description, setDescription] = useState(role.description ?? '');
  const [canUpdateAllSettings, setCanUpdateAllSettings] = useState(
    role.canUpdateAllSettings,
  );
  const [canReadAllObjectRecords, setCanReadAllObjectRecords] = useState(
    role.canReadAllObjectRecords,
  );
  const [canUpdateAllObjectRecords, setCanUpdateAllObjectRecords] = useState(
    role.canUpdateAllObjectRecords,
  );
  const [canSoftDeleteAllObjectRecords, setCanSoftDeleteAllObjectRecords] =
    useState(role.canSoftDeleteAllObjectRecords);
  const [canDestroyAllObjectRecords, setCanDestroyAllObjectRecords] = useState(
    role.canDestroyAllObjectRecords,
  );

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [updateOneRole, { loading: isSaving }] = useMutation(UPDATE_ONE_ROLE, {
    refetchQueries: [{ query: GET_ROLES }],
  });

  const [deleteOneRole, { loading: isDeleting }] = useMutation(
    DELETE_ONE_ROLE,
    {
      refetchQueries: [{ query: GET_ROLES }],
    },
  );

  const handleSave = async () => {
    const trimmed = label.trim();
    if (trimmed.length === 0) {
      enqueueSnackBar(tMacro`Please enter a role name.`, {
        variant: SnackBarVariant.Error,
      });
      return;
    }

    try {
      await updateOneRole({
        variables: {
          updateRoleInput: {
            id: role.id,
            label: trimmed,
            description,
            canUpdateAllSettings,
            canReadAllObjectRecords,
            canUpdateAllObjectRecords,
            canSoftDeleteAllObjectRecords,
            canDestroyAllObjectRecords,
          },
        },
      });
      enqueueSnackBar(tMacro`Role saved`, { variant: SnackBarVariant.Success });
      await onRoleUpdated();
    } catch (error) {
      enqueueSnackBar(
        error instanceof ApolloError
          ? getErrorMessage(error)
          : tMacro`Could not save role`,
        { variant: SnackBarVariant.Error },
      );
    }
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteOneRole({
        variables: { roleId: role.id },
      });
      enqueueSnackBar(tMacro`Role deleted`, {
        variant: SnackBarVariant.Success,
      });
      setIsDeleteModalOpen(false);
      navigateSettings(SettingsPath.Roles);
    } catch (error) {
      enqueueSnackBar(
        error instanceof ApolloError
          ? getErrorMessage(error)
          : tMacro`Could not delete role`,
        { variant: SnackBarVariant.Error },
      );
    }
  };

  const deleteModal = isDeleteModalOpen ? (
    <Modal
      isClosable
      onClose={() => setIsDeleteModalOpen(false)}
      size="medium"
      padding="none"
    >
      <StyledConfirmShell>
        <StyledConfirmHeader>
          <StyledConfirmTitle>{tMacro`Delete role`}</StyledConfirmTitle>
          <IconButton
            Icon={IconX}
            variant="tertiary"
            size="small"
            onClick={() => setIsDeleteModalOpen(false)}
            ariaLabel={tMacro`Close`}
          />
        </StyledConfirmHeader>
        <StyledConfirmBody>
          {tMacro`Members with this role will be moved to the Member role.`}
        </StyledConfirmBody>
        <StyledConfirmFooter>
          <Button
            title={tMacro`Cancel`}
            variant="secondary"
            onClick={() => setIsDeleteModalOpen(false)}
            disabled={isDeleting}
          />
          <Button
            title={tMacro`Delete`}
            variant="secondary"
            accent="danger"
            onClick={() => void handleConfirmDelete()}
            disabled={isDeleting}
          />
        </StyledConfirmFooter>
      </StyledConfirmShell>
    </Modal>
  ) : null;

  if (role.isEditable === false) {
    return (
      <>
        <StyledInputsContainer>
          <StyledInputContainer>
            <IconPicker
              disabled={true}
              selectedIconKey={'IconUser'}
              onChange={() => {}}
            />
          </StyledInputContainer>
          <TextInput value={role.label} disabled fullWidth />
        </StyledInputsContainer>
        <TextArea
          minRows={4}
          placeholder={tMacro`Write a description`}
          value={role.description || ''}
          disabled
        />
      </>
    );
  }

  return (
    <>
      <Section>
        <H2Title
          title={tMacro`Details`}
          description={tMacro`Name and description for this role`}
        />
        <StyledInputsContainer>
          <StyledInputContainer>
            <IconPicker
              disabled={true}
              selectedIconKey={'IconUser'}
              onChange={() => {}}
            />
          </StyledInputContainer>
          <TextInput
            label={tMacro`Name`}
            value={label}
            onChange={setLabel}
            fullWidth
          />
        </StyledInputsContainer>
        <TextArea
          minRows={4}
          placeholder={tMacro`Write a description`}
          value={description}
          onChange={(value) => setDescription(value)}
        />
      </Section>

      <Section>
        <H2Title
          title={tMacro`Permissions`}
          description={tMacro`Workspace and records access for this role`}
        />
        <StyledToggleRow>
          <span>{tMacro`Workspace administration (settings, roles, API keys)`}</span>
          <Toggle
            value={canUpdateAllSettings}
            onChange={(value) => setCanUpdateAllSettings(value)}
          />
        </StyledToggleRow>
        <StyledToggleRow>
          <span>{tMacro`See records on all objects`}</span>
          <Toggle
            value={canReadAllObjectRecords}
            onChange={(value) => setCanReadAllObjectRecords(value)}
          />
        </StyledToggleRow>
        <StyledToggleRow>
          <span>{tMacro`Edit records on all objects`}</span>
          <Toggle
            value={canUpdateAllObjectRecords}
            onChange={(value) => setCanUpdateAllObjectRecords(value)}
          />
        </StyledToggleRow>
        <StyledToggleRow>
          <span>{tMacro`Soft-delete records on all objects`}</span>
          <Toggle
            value={canSoftDeleteAllObjectRecords}
            onChange={(value) => setCanSoftDeleteAllObjectRecords(value)}
          />
        </StyledToggleRow>
        <StyledToggleRow>
          <span>{tMacro`Destroy records on all objects`}</span>
          <Toggle
            value={canDestroyAllObjectRecords}
            onChange={(value) => setCanDestroyAllObjectRecords(value)}
          />
        </StyledToggleRow>
      </Section>

      <StyledActions>
        <StyledButtonRow>
          <Button
            title={tMacro`Save changes`}
            variant="primary"
            onClick={() => void handleSave()}
            disabled={isSaving}
          />
        </StyledButtonRow>
        <StyledButtonRow>
          <Button
            title={tMacro`Delete role`}
            variant="secondary"
            accent="danger"
            onClick={() => setIsDeleteModalOpen(true)}
            disabled={isDeleting}
          />
        </StyledButtonRow>
      </StyledActions>

      {deleteModal}
    </>
  );
};
