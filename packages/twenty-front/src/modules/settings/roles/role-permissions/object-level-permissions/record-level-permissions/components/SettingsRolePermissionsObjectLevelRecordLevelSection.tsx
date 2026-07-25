/* @license Enterprise */

import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { H2Title } from 'twenty-ui/typography';
import { Section } from 'twenty-ui/layout';

import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { SettingsRolePermissionsObjectLevelRecordLevelPermissionFilterBuilder } from '@/settings/roles/role-permissions/object-level-permissions/record-level-permissions/components/SettingsRolePermissionsObjectLevelRecordLevelPermissionFilterBuilder';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledContent = styled.div`
  padding-bottom: ${themeCssVariables.spacing[2]};
`;

type SettingsRolePermissionsObjectLevelRecordLevelSectionProps = {
  objectMetadataItem: EnrichedObjectMetadataItem;
  roleId: string;
};

export const SettingsRolePermissionsObjectLevelRecordLevelSection = ({
  objectMetadataItem,
  roleId,
}: SettingsRolePermissionsObjectLevelRecordLevelSectionProps) => {
  return (
    <Section>
      <H2Title
        title={t`Record-level`}
        description={t`Ability to filter the records a user can interact with.`}
      />
      <StyledContent>
        <SettingsRolePermissionsObjectLevelRecordLevelPermissionFilterBuilder
          roleId={roleId}
          objectMetadataItem={objectMetadataItem}
        />
      </StyledContent>
    </Section>
  );
};
