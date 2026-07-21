import { Button } from 'twenty-ui';
import { IconBook2 } from 'twenty-ui/icons';
import { useLingui } from '@lingui/react/macro';

export const SettingsReadDocumentationButton = () => {
  const { t } = useLingui();

  return (
    <Button
      title={t`Read documentation`}
      variant="secondary"
      accent="default"
      size="small"
      Icon={IconBook2}
      to={'https://arxena.com/solutions/org-chart-embed'}
      target="_blank"
    ></Button>
  );
};
