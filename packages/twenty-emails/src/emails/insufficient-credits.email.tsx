import { Trans } from '@lingui/react/macro';
import { BaseEmail } from 'src/components/BaseEmail';
import { MainText } from 'src/components/MainText';
import { Title } from 'src/components/Title';
import { APP_LOCALES } from 'twenty-shared';

type InsufficientCreditsEmailProps = {
  userName: string;
  workspaceDisplayName: string | undefined;
  locale?: keyof typeof APP_LOCALES;
};

export const InsufficientCreditsEmail = ({
  userName,
  workspaceDisplayName,
  locale = 'en',
}: InsufficientCreditsEmailProps) => {
  const helloString = userName?.length > 1 ? `Hello ${userName}` : 'Hello';

  return (
    <BaseEmail width={333} locale={locale}>
      <Title value="Insufficient OpenAI Credits ⚠️" />
      <MainText>
        {helloString},
        <br />
        <br />
        <Trans>
          Your workspace <b>{workspaceDisplayName}</b> has run out of OpenAI credits.
        </Trans>
        <br />
        <br />
        <Trans>
          To continue using AI-powered features, please add more credits in your OpenAI account.
          You can add credits in your OpenAI account by clicking the button below.
        </Trans>
      </MainText>
    </BaseEmail>
  );
}; 