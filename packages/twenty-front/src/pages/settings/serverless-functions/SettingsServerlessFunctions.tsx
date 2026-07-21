import { Button, Section, UndecoratedLink } from 'twenty-ui';
import { IconPlus } from 'twenty-ui/icons';
import { SettingsServerlessFunctionsTable } from '@/settings/serverless-functions/components/SettingsServerlessFunctionsTable';
import { SettingsPath } from '@/types/SettingsPath';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';

import { getSettingsPath } from '~/utils/navigation/getSettingsPath';

export const SettingsServerlessFunctions = () => {
  return (
    <SubMenuTopBarContainer
      title="Functions"
      actionButton={
        <UndecoratedLink
          to={getSettingsPath(SettingsPath.NewServerlessFunction)}
        >
          <Button
            Icon={IconPlus}
            title="New Function"
            accent="blue"
            size="small"
          />
        </UndecoratedLink>
      }
      links={[
        {
          children: 'Workspace',
          href: getSettingsPath(SettingsPath.Workspace),
        },
        {
          children: 'Functions',
        },
      ]}
    >
      <Section>
        <SettingsServerlessFunctionsTable />
      </Section>
    </SubMenuTopBarContainer>
  );
};
