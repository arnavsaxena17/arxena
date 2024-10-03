import { ChangeEvent, ReactNode, useRef } from 'react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import { Tooltip } from 'react-tooltip';
import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { Avatar, AvatarType } from 'twenty-ui';
import { v4 as uuidV4 } from 'uuid';

import {
  beautifyExactDateTime,
  beautifyPastDateRelativeToNow,
} from '~/utils/date-utils';
import { isDefined } from '~/utils/isDefined';
import React from 'react';

type ShowPageSummaryCardProps = {
  avatarPlaceholder: string;
  avatarType: AvatarType;
  date: string;
  id?: string;
  logoOrAvatar?: string;
  onUploadPicture?: (file: File) => void;
  title: ReactNode;
  loading: boolean;
  showChatIcon?: boolean;
  onChatIconClick?: () => void;

};

const ChatIcon = ({ onClick }: { onClick?: () => void }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    onClick={(e) => {
      e.stopPropagation(); // Prevent event bubbling
      console.log("Chat icon clicked"); // Debug log
      onClick?.();
    }}
    style={{ cursor: 'pointer' }}
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    <line x1="9" y1="10" x2="15" y2="10"></line>
    <line x1="9" y1="14" x2="15" y2="14"></line>
  </svg>
);

export const StyledShowPageSummaryCard = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(4)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  height: 127px;
`;

const StyledInfoContainer = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  width: 100%;
`;

const StyledDate = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  cursor: pointer;
`;

const StyledTitle = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.xl};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  justify-content: center;
`;

const StyledTooltip = styled(Tooltip)`
  background-color: ${({ theme }) => theme.background.primary};
  box-shadow: ${({ theme }) => theme.boxShadow.light};

  color: ${({ theme }) => theme.font.color.primary};

  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.regular};
  padding: ${({ theme }) => theme.spacing(2)};
`;

const StyledAvatarWrapper = styled.div`
  cursor: pointer;
`;

const StyledFileInput = styled.input`
  display: none;
`;

const StyledSubSkeleton = styled.div`
  align-items: center;
  display: flex;
  height: 37px;
  justify-content: center;
  width: 108px;
`;

const StyledShowPageSummaryCardSkeletonLoader = () => {
  const theme = useTheme();
  return (
    <SkeletonTheme
      baseColor={theme.background.tertiary}
      highlightColor={theme.background.transparent.lighter}
      borderRadius={4}
    >
      <Skeleton width={40} height={40} />
      <StyledSubSkeleton>
        <Skeleton width={96} height={16} />
      </StyledSubSkeleton>
    </SkeletonTheme>
  );
};

export const ShowPageSummaryCard = ({
  avatarPlaceholder,
  avatarType,
  date,
  id,
  logoOrAvatar,
  onUploadPicture,
  title,
  loading,
  showChatIcon = false,
  onChatIconClick,

}: ShowPageSummaryCardProps) => {
  const beautifiedCreatedAt =
    date !== '' ? beautifyPastDateRelativeToNow(date) : '';
  const exactCreatedAt = date !== '' ? beautifyExactDateTime(date) : '';
  const dateElementId = `date-id-${uuidV4()}`;
  const inputFileRef = useRef<HTMLInputElement>(null);

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (isDefined(e.target.files)) onUploadPicture?.(e.target.files[0]);
  };

  const handleAvatarClick = () => {
    inputFileRef?.current?.click?.();
  };

  if (loading)
    return (
      <StyledShowPageSummaryCard>
        <StyledShowPageSummaryCardSkeletonLoader />
      </StyledShowPageSummaryCard>
    );

  console.log("Current ID for this page is :", id);
  console.log("Current title for this page is :", title);
  if (React.isValidElement(title)) {
    console.log("Current title value for this page is :", title.props.value);
    console.log("Current title valjue for this page is : margin", title?.props?.value?.entityId);
    console.log("Current title valjue for this page is : margin", title?.props?.value?.fieldDefinition?.metadata?.objectMetadataNameSingular);
    const objectId = title?.props?.value?.entityId;
    const objectName = title?.props?.value?.fieldDefinition?.metadata?.objectMetadataNameSingular;
  }
  // console.log("Current title for this page is :", title?.props?.value.fieldMetadataId);
  // console.log("Current title for this page is :", title?.props?.value.metadata.objectMetadataNameSingular);
  console.log("Current avatarType for this page is :", avatarType);

  console.log("This is the cshowChatIcon:", showChatIcon);
  return (
    <StyledShowPageSummaryCard>
      <StyledAvatarWrapper>
        <Avatar
          avatarUrl={logoOrAvatar}
          onClick={onUploadPicture ? handleAvatarClick : undefined}
          size="xl"
          entityId={id}
          placeholder={avatarPlaceholder}
          type={avatarType}
        />
        <StyledFileInput
          ref={inputFileRef}
          onChange={onFileChange}
          type="file"
        />
      </StyledAvatarWrapper>
      <StyledInfoContainer>
        <StyledTitle>{title}</StyledTitle>
        {beautifiedCreatedAt && (
          <StyledDate id={dateElementId}>
            Added {beautifiedCreatedAt}
          </StyledDate>
        )}
        <StyledTooltip
          anchorSelect={`#${dateElementId}`}
          content={exactCreatedAt}
          clickable
          noArrow
          place="right"
        />
      </StyledInfoContainer>
      {showChatIcon && (
        <div onClick={(e) => {
          e.stopPropagation();
          console.log("Chat icon container clicked"); // Debug log
          onChatIconClick?.();
        }} style={{ cursor: 'pointer' }}>
          <ChatIcon onClick={onChatIconClick} />
        </div>
      )}
    </StyledShowPageSummaryCard>
  );
};
