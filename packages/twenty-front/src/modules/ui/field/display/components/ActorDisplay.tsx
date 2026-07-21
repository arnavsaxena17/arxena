import { AvatarChip, AvatarChipVariant, IconGmail, IconGoogleCalendar, IconMicrosoftCalendar, IconMicrosoftOutlook } from 'twenty-ui';
import { IconApi, IconCalendar, IconCsv, IconMail, IconRobot, IconSettingsAutomation } from 'twenty-ui/icons';
import { FieldActorValue } from '@/object-record/record-field/types/FieldMetadata';
import { ConnectedAccountProvider } from 'twenty-shared';

import { useMemo } from 'react';

type ActorDisplayProps = Partial<FieldActorValue> & {
  avatarUrl?: string | null;
};

const PROVIDORS_ICON_MAPPING = {
  EMAIL: {
    [ConnectedAccountProvider.MICROSOFT]: IconMicrosoftOutlook,
    [ConnectedAccountProvider.GOOGLE]: IconGmail,
    default: IconMail,
  },
  CALENDAR: {
    [ConnectedAccountProvider.MICROSOFT]: IconMicrosoftCalendar,
    [ConnectedAccountProvider.GOOGLE]: IconGoogleCalendar,
    default: IconCalendar,
  },
};

export const ActorDisplay = ({
  name,
  source,
  workspaceMemberId,
  avatarUrl,
  context,
}: ActorDisplayProps) => {
  const LeftIcon = useMemo(() => {
    switch (source) {
      case 'API':
        return IconApi;
      case 'IMPORT':
        return IconCsv;
      case 'EMAIL':
        return PROVIDORS_ICON_MAPPING.EMAIL[context?.provider ?? 'default'];
      case 'CALENDAR':
        return PROVIDORS_ICON_MAPPING.CALENDAR[context?.provider ?? 'default'];
      case 'SYSTEM':
        return IconRobot;
      case 'WORKFLOW':
        return IconSettingsAutomation;
      default:
        return undefined;
    }
  }, [source, context?.provider]);

  const isIconInverted =
    source === 'API' || source === 'IMPORT' || source === 'SYSTEM';

  return (
    <AvatarChip
      placeholderColorSeed={workspaceMemberId ?? undefined}
      name={name ?? ''}
      avatarType={workspaceMemberId ? 'rounded' : 'squared'}
      LeftIcon={LeftIcon}
      avatarUrl={avatarUrl ?? undefined}
      isIconInverted={isIconInverted}
      variant={AvatarChipVariant.Transparent}
    />
  );
};
