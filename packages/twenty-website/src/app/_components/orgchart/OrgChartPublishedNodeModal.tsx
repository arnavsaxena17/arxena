'use client';

import styled from '@emotion/styled';
import { IconBrandLinkedin, IconMail, IconPhone, IconX } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';

import {
  buildOrgChartNodeProfiles,
  type OrgChartNodeProfile,
} from '@/lib/build-org-chart-node-profiles';
import { type OrgChartNodeData } from 'twenty-shared';

const DEFAULT_AVATAR = '/img/default-avatar.jpg';

const StyledBackdrop = styled.div`
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(4px);
`;

const StyledDialog = styled.div`
  position: relative;
  width: min(720px, 100%);
  max-height: min(92vh, 900px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.28);
`;

const StyledHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(20, 20, 20, 0.08);
`;

const StyledTitle = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.3;
  color: #141414;
`;

const StyledCloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #818181;
  cursor: pointer;

  &:hover {
    background: rgba(20, 20, 20, 0.06);
    color: #141414;
  }
`;

const StyledBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 24px 24px;
  overflow-y: auto;
  max-height: min(560px, calc(92vh - 140px));
`;

const StyledProfileCard = styled.div`
  display: flex;
  gap: 16px;
  padding: 16px;
  border: 1px solid rgba(20, 20, 20, 0.08);
  border-radius: 12px;
  background: #fff;
`;

const StyledAvatarWrapper = styled.div`
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid rgba(20, 20, 20, 0.08);
`;

const StyledAvatarImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const StyledProfileTextColumn = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
`;

const StyledProfileNameRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
`;

const StyledProfileName = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: #141414;
`;

const StyledTenureDot = styled.span<{ $variant: 'current' | 'past' }>`
  color: ${({ $variant }) => ($variant === 'current' ? '#16a34a' : '#a3a3a3')};
  font-size: 12px;
`;

const StyledProfileSubline = styled.div`
  font-size: 14px;
  line-height: 1.45;
  color: #474747;
`;

const StyledProfileActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
`;

const StyledExternalLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #2563eb;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const StyledFetchContactsButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: none;
  background: none;
  font-size: 14px;
  font-weight: 500;
  color: #2563eb;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`;

const StyledEmptyState = styled.div`
  padding: 32px 16px;
  text-align: center;
  color: #666;
  font-size: 14px;
  line-height: 1.5;
`;

type ProfileRowProps = {
  profile: OrgChartNodeProfile;
  onFetchContacts: () => void;
};

const ProfileRow = ({ profile, onFetchContacts }: ProfileRowProps) => {
  const [avatarSrc, setAvatarSrc] = useState(
    profile.imageUrl?.trim() || DEFAULT_AVATAR,
  );
  const roleCompanyLine = [profile.headline, profile.company]
    .filter((part) => typeof part === 'string' && part.trim().length > 0)
    .join(' · ');

  return (
    <StyledProfileCard>
      <StyledAvatarWrapper>
        <StyledAvatarImage
          src={avatarSrc}
          alt=""
          onError={() => setAvatarSrc(DEFAULT_AVATAR)}
        />
      </StyledAvatarWrapper>
      <StyledProfileTextColumn>
        <StyledProfileNameRow>
          <StyledProfileName>{profile.fullName}</StyledProfileName>
          {profile.companyTenure && (
            <StyledTenureDot
              $variant={profile.companyTenure}
              title={
                profile.companyTenure === 'current'
                  ? 'Current employee at this company'
                  : 'Past employee at this company'
              }
            >
              ●
            </StyledTenureDot>
          )}
        </StyledProfileNameRow>
        {roleCompanyLine.length > 0 && (
          <StyledProfileSubline>{roleCompanyLine}</StyledProfileSubline>
        )}
        {profile.location && (
          <StyledProfileSubline>{profile.location}</StyledProfileSubline>
        )}
        <StyledProfileActions>
          {profile.linkedinUrl && (
            <StyledExternalLink
              href={profile.linkedinUrl}
              target="_blank"
              rel="noreferrer"
            >
              <IconBrandLinkedin size={16} stroke={1.5} />
              View on LinkedIn
            </StyledExternalLink>
          )}
          <StyledFetchContactsButton type="button" onClick={onFetchContacts}>
            <IconPhone size={16} stroke={1.5} />
            <IconMail size={16} stroke={1.5} />
            Fetch contacts
          </StyledFetchContactsButton>
        </StyledProfileActions>
      </StyledProfileTextColumn>
    </StyledProfileCard>
  );
};

export type OrgChartPublishedNodeModalProps = {
  node: OrgChartNodeData;
  companyName?: string;
  onClose: () => void;
  onFetchContacts: () => void;
};

export const OrgChartPublishedNodeModal = ({
  node,
  companyName,
  onClose,
  onFetchContacts,
}: OrgChartPublishedNodeModalProps) => {
  const profiles = useMemo(
    () => buildOrgChartNodeProfiles(node, companyName),
    [node, companyName],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <StyledBackdrop onClick={onClose} role="presentation">
      <StyledDialog
        onClick={(event) => {
          event.stopPropagation();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="orgchart-published-node-modal-title"
      >
        <StyledHeader>
          <StyledTitle id="orgchart-published-node-modal-title">
            {node.headline}
          </StyledTitle>
          <StyledCloseButton
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <IconX size={20} stroke={1.75} />
          </StyledCloseButton>
        </StyledHeader>
        <StyledBody>
          {profiles.length > 0 ? (
            profiles.map((profile) => (
              <ProfileRow
                key={profile.id}
                profile={profile}
                onFetchContacts={onFetchContacts}
              />
            ))
          ) : (
            <StyledEmptyState>
              No people are attached to this node yet.
            </StyledEmptyState>
          )}
        </StyledBody>
      </StyledDialog>
    </StyledBackdrop>
  );
};
