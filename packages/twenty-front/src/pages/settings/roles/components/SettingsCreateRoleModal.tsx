import { ApolloError, useMutation } from '@apollo/client';
import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { isDefined } from 'twenty-shared';
import { Button, IconButton, IconX } from 'twenty-ui';

import { CREATE_ONE_ROLE } from '@/settings/roles/graphql/mutations/createOneRoleMutation';
import { GET_ROLES } from '@/settings/roles/graphql/queries/getRolesQuery';
import { SettingsPath } from '@/types/SettingsPath';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { TextArea } from '@/ui/input/components/TextArea';
import { TextInput } from '@/ui/input/components/TextInput';
import { Modal } from '@/ui/layout/modal/components/Modal';
import { useNavigateSettings } from '~/hooks/useNavigateSettings';

const StyledShell = styled.div`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  max-width: 100%;
  min-width: 0;
  width: 100%;
`;

const StyledHeader = styled.div`
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

const StyledTitle = styled.h2`
  color: ${({ theme }) => theme.font.color.primary};
  flex: 1;
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  line-height: ${({ theme }) => theme.text.lineHeight.md};
  margin: 0;
  min-width: 0;
`;

const StyledBody = styled.div`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  min-width: 0;
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledFooter = styled.div`
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

type SettingsCreateRoleModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const getErrorMessage = (error: ApolloError): string => {
  const graphQLError = error.graphQLErrors?.[0];
  if (isDefined(graphQLError?.message) && graphQLError.message.length > 0) {
    return graphQLError.message;
  }
  return error.message;
};

export const SettingsCreateRoleModal = ({
  isOpen,
  onClose,
}: SettingsCreateRoleModalProps) => {
  const { t } = useLingui();
  const { enqueueSnackBar } = useSnackBar();
  const navigateSettings = useNavigateSettings();
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');

  const [createOneRole, { loading }] = useMutation(CREATE_ONE_ROLE, {
    refetchQueries: [{ query: GET_ROLES }],
  });

  const handleClose = () => {
    setLabel('');
    setDescription('');
    onClose();
  };

  const handleSubmit = async () => {
    const trimmed = label.trim();
    if (trimmed.length === 0) {
      enqueueSnackBar(t`Please enter a role name.`, {
        variant: SnackBarVariant.Error,
      });
      return;
    }

    try {
      const result = await createOneRole({
        variables: {
          createRoleInput: {
            label: trimmed,
            description: description.trim() || undefined,
          },
        },
      });

      const newId = result.data?.createOneRole?.id;
      enqueueSnackBar(t`Role created`, { variant: SnackBarVariant.Success });
      handleClose();
      if (isDefined(newId)) {
        navigateSettings(SettingsPath.RoleDetail, { roleId: newId });
      }
    } catch (error) {
      enqueueSnackBar(
        error instanceof ApolloError
          ? getErrorMessage(error)
          : t`Could not create role`,
        { variant: SnackBarVariant.Error },
      );
    }
  };

  if (isOpen === false) {
    return null;
  }

  return (
    <Modal isClosable onClose={handleClose} size="medium" padding="none">
      <StyledShell>
        <StyledHeader>
          <StyledTitle>{t`Create role`}</StyledTitle>
          <IconButton
            Icon={IconX}
            variant="tertiary"
            size="small"
            onClick={handleClose}
            ariaLabel={t`Close`}
          />
        </StyledHeader>
        <StyledBody>
          <TextInput
            label={t`Name`}
            value={label}
            onChange={setLabel}
            placeholder={t`e.g. Sales`}
            fullWidth
            autoFocusOnMount
          />
          <TextArea
            minRows={3}
            placeholder={t`Description (optional)`}
            value={description}
            onChange={(value) => setDescription(value)}
          />
        </StyledBody>
        <StyledFooter>
          <Button
            title={t`Cancel`}
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
          />
          <Button
            title={t`Create`}
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={loading}
          />
        </StyledFooter>
      </StyledShell>
    </Modal>
  );
};
