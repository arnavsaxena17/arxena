import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Img } from '@react-email/components';
import { emailTheme } from 'src/common-style';

import { BaseEmail } from 'src/components/BaseEmail';
import { CallToAction } from 'src/components/CallToAction';
import { HighlightedContainer } from 'src/components/HighlightedContainer';
import { HighlightedText } from 'src/components/HighlightedText';
import { Link } from 'src/components/Link';
import { MainText } from 'src/components/MainText';
import { Title } from 'src/components/Title';
import { WhatIsArxena } from 'src/components/WhatIsArxena';
import { capitalize } from 'src/utils/capitalize';
import { APP_LOCALES, getImageAbsoluteURI } from 'twenty-shared';

type SendInviteLinkEmailProps = {
  link: string;
  workspace: { name: string | undefined; logo: string | undefined };
  sender: {
    email: string;
    firstName: string;
    lastName: string;
  };
  serverUrl: string;
  locale: keyof typeof APP_LOCALES;
};

export const SendInviteLinkEmail = ({
  link,
  workspace,
  sender,
  serverUrl,
  locale,
}: SendInviteLinkEmailProps) => {
  const workspaceLogo = workspace.logo
    ? getImageAbsoluteURI({ imageUrl: workspace.logo, baseUrl: serverUrl })
    : null;

    console.log("workspaceLogo is this::", workspaceLogo);
    console.log("workspace is this::", workspace);
    console.log("sender is this::", sender);
    console.log("serverUrl is this::", serverUrl);
    console.log("locale is this::", locale);
    console.log("link is this::", link);
    console.log("capitalize(sender.firstName) is this::", capitalize(sender.firstName));
    // console.log("capitalize(sender.lastName) is this::", capitalize(sender.lastName));
    // console.log("capitalize(sender.email) is this::", capitalize(sender.email));
    // console.log("capitalize(workspace.name) is this::", capitalize(workspace.name));
    // console.log("capitalize(workspace.logo) is this::", capitalize(workspace));
    console.log("capitalize(serverUrl) is this::", capitalize(serverUrl));
    console.log("capitalize(locale) is this::", capitalize(locale));

  return (
    <BaseEmail width={333} locale={locale}>
      <Title value={t`Join your team on Arxena`} />
      <MainText>
        {capitalize(sender.firstName)} (
        <Link
          href={`mailto:${sender.email}`}
          value={sender.email}
          color={emailTheme.font.colors.blue}
        />
        )
        <Trans>has invited you to join workspace </Trans>
        <b>{workspace.name}</b>
        <br />
      </MainText>
      <HighlightedContainer>
        {workspaceLogo && <Img src={workspaceLogo} width={40} height={40} />}
        {workspace.name && <HighlightedText value={workspace.name} />}
        <CallToAction href={link} value={t`Accept invite`} />
      </HighlightedContainer>
      <WhatIsArxena />
    </BaseEmail>
  );
};
