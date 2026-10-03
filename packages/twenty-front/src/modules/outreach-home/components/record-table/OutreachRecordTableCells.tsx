import { styled } from '@linaria/react';
import { isNonEmptyString } from '@sniptt/guards';
import { type MouseEvent } from 'react';
import {
  Avatar,
  Chip,
  ChipVariant,
  Tag,
  type TagColor,
} from 'twenty-ui/data-display';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { LinkDisplay } from '@/ui/field/display/components/LinkDisplay';
import { beautifyPastDateRelativeToNow } from '~/utils/date-utils';

const StyledText = styled.span<{ isMuted?: boolean }>`
  color: ${({ isMuted }) =>
    isMuted
      ? themeCssVariables.font.color.tertiary
      : themeCssVariables.font.color.primary};
  display: block;
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledStopPropagation = styled.span`
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
`;

const stopPropagation = (event: MouseEvent) => {
  event.stopPropagation();
};

type OutreachRecordChipCellProps = {
  name: string;
  avatarType: 'rounded' | 'squared';
  avatarUrl?: string | null;
  onClick?: () => void;
};

// Label identifier cell: same Chip + Avatar combo Twenty uses for the first
// column of a record index.
export const OutreachRecordChipCell = ({
  name,
  avatarType,
  avatarUrl,
  onClick,
}: OutreachRecordChipCellProps) => (
  <StyledStopPropagation
    onClick={(event) => {
      if (onClick === undefined) {
        return;
      }

      event.stopPropagation();
      onClick();
    }}
  >
    <Chip
      label={name || 'Untitled'}
      variant={ChipVariant.Highlighted}
      clickable={onClick !== undefined}
      leftComponent={
        <Avatar
          avatarUrl={avatarUrl}
          placeholder={name}
          placeholderColorSeed={name}
          type={avatarType}
          size="sm"
        />
      }
    />
  </StyledStopPropagation>
);

export const OutreachTextCell = ({
  value,
  isMuted,
}: {
  value: string | null | undefined;
  isMuted?: boolean;
}) =>
  isNonEmptyString(value) ? (
    <StyledText isMuted={isMuted} title={value}>
      {value}
    </StyledText>
  ) : null;

export const OutreachTagCell = ({
  label,
  color,
}: {
  label: string | null | undefined;
  color: TagColor;
}) => (isNonEmptyString(label) ? <Tag color={color} text={label} /> : null);

export const OutreachLinkCell = ({
  url,
  label,
}: {
  url: string | null | undefined;
  label?: string;
}) =>
  isNonEmptyString(url) ? (
    <StyledStopPropagation onClick={stopPropagation}>
      <LinkDisplay value={{ url, label }} />
    </StyledStopPropagation>
  ) : null;

export const OutreachRelativeDateCell = ({
  value,
}: {
  value: string | null | undefined;
}) => {
  if (!isNonEmptyString(value) || Number.isNaN(new Date(value).getTime())) {
    return null;
  }

  return (
    <StyledText isMuted title={new Date(value).toLocaleString()}>
      {beautifyPastDateRelativeToNow(value)}
    </StyledText>
  );
};
