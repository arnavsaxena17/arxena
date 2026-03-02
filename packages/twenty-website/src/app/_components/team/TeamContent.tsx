'use client';

import styled from '@emotion/styled';
import { IconBrandLinkedin } from '@tabler/icons-react';

import { TEAM_MEMBERS } from '@/lib/team-content';

const StyledCtaSection = styled.div`
  margin-top: 48px;
  text-align: center;
`;

const StyledCtaLink = styled.a`
  display: inline-flex;
  align-items: center;
  height: 48px;
  padding: 0 24px;
  background-color: #000;
  color: #fff;
  border-radius: 8px;
  font-weight: 500;
  text-decoration: none;
  font-size: 16px;
  transition: color 0.15s ease;

  &:hover {
    color: #b3b3b3;
  }
`;

function getAvatarUrl(name: string, photo?: string): string {
  if (photo) return photo;
  const encoded = encodeURIComponent(name.replace(/\s+/g, '+'));
  return `https://ui-avatars.com/api/?name=${encoded}&size=160&background=e5e5e5&color=474747`;
}

const StyledSection = styled.section`
  max-width: 720px;
  margin: 0 auto;
  padding: 64px 24px 96px;
`;

const StyledHeadline = styled.h1`
  font-size: clamp(2.5rem, 6vw, 4rem);
  font-weight: 600;
  line-height: 1.1;
  margin: 0 0 24px 0;
  text-align: center;
  color: #141414;
`;

const StyledHeadlineSub = styled.p`
  font-size: 18px;
  color: #818181;
  margin: 0 0 48px 0;
  text-align: center;
  line-height: 1.5;
`;

const StyledTeamGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 48px;
`;

const StyledMemberCard = styled.article`
  display: flex;
  gap: 32px;
  align-items: flex-start;
  padding: 32px;
  background: #fafafa;
  border-radius: 12px;
  border: 1px solid rgba(20, 20, 20, 0.08);

  @media (max-width: 640px) {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
`;

const StyledAvatar = styled.img`
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
`;

const StyledMemberInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const StyledMemberName = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: #141414;
`;

const StyledMemberRole = styled.p`
  font-size: 15px;
  color: #818181;
  margin: 0 0 12px 0;
`;

const StyledMemberBio = styled.p`
  font-size: 16px;
  line-height: 1.6;
  color: #474747;
  margin: 0 0 12px 0;
`;

const StyledSocialLinks = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
`;

const StyledSocialLink = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  color: #474747;
  background: #fff;
  border: 1px solid rgba(20, 20, 20, 0.12);
  transition:
    background 0.15s ease,
    color 0.15s ease;

  &:hover {
    background: #f5f5f5;
    color: #141414;
  }
`;

type TeamContentProps = {
  signInUrl: string;
  signUpUrl: string;
};

export const TeamContent = ({ signInUrl, signUpUrl }: TeamContentProps) => {
  return (
    <StyledSection>
      <StyledHeadline>Meet the team</StyledHeadline>
      <StyledHeadlineSub>
        The people building the world&apos;s first org chart database.
      </StyledHeadlineSub>
      <StyledTeamGrid>
        {TEAM_MEMBERS.map((member) => (
          <StyledMemberCard key={member.name}>
            <StyledAvatar
              src={getAvatarUrl(member.name, member.photo)}
              alt={member.name}
            />
            <StyledMemberInfo>
              <StyledMemberName>{member.name}</StyledMemberName>
              <StyledMemberRole>{member.role}</StyledMemberRole>
              <StyledMemberBio>{member.bio}</StyledMemberBio>
              <StyledSocialLinks>
                {member.linkedin && (
                  <StyledSocialLink
                    href={member.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${member.name} on LinkedIn`}
                  >
                    <IconBrandLinkedin size={20} />
                  </StyledSocialLink>
                )}
                {member.twitter && (
                  <StyledSocialLink
                    href={member.twitter}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${member.name} on Twitter`}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </StyledSocialLink>
                )}
              </StyledSocialLinks>
            </StyledMemberInfo>
          </StyledMemberCard>
        ))}
      </StyledTeamGrid>
      <StyledCtaSection>
        <StyledCtaLink href={signUpUrl}>Try Arxena free</StyledCtaLink>
      </StyledCtaSection>
    </StyledSection>
  );
};
