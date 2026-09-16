import { extractLinkedinProfileId } from 'src/engine/core-modules/outreach-command/utils/extract-linkedin-profile-id.util';

const readString = (row: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const primary = (value as Record<string, unknown>).primaryLinkUrl;

      if (typeof primary === 'string' && primary.trim()) {
        return primary.trim();
      }
    }
  }

  return '';
};

export const mapUploadProfileToLinkedinSearchRow = (
  row: unknown,
  companyId = '',
): Record<string, unknown> => {
  if (typeof row !== 'object' || row === null) {
    return {};
  }

  const person = row as Record<string, unknown>;
  const linkedinUrl =
    readString(person, [
      'linkedinUrl',
      'linkedinLink',
      'profileUrl',
      'profile_url',
    ]) ||
    (readString(person, ['linkedinProfileId', 'public_identifier'])
      ? `https://www.linkedin.com/in/${readString(person, ['linkedinProfileId', 'public_identifier'])}`
      : '');
  const linkedinProfileId =
    readString(person, ['linkedinProfileId', 'public_identifier']) ||
    extractLinkedinProfileId(linkedinUrl);
  const profilePictureUrl = readString(person, [
    'profilePictureUrl',
    'displayPicture',
    'profile_picture_url',
    'avatarUrl',
  ]);
  const profilePictureUrlLarge = readString(person, [
    'profile_picture_url_large',
    'profilePictureUrlLarge',
  ]);
  const summary = readString(person, ['summary', 'linkedinSummary', 'about']);
  const firstName = readString(person, ['firstName', 'first_name']);
  const lastName = readString(person, ['lastName', 'last_name']);
  const name =
    readString(person, ['name', 'fullName']) ||
    [firstName, lastName].filter(Boolean).join(' ');
  const experience = Array.isArray(person.experience)
    ? person.experience[0]
    : Array.isArray(person.work_experience)
      ? person.work_experience[0]
      : null;
  const experienceRecord =
    experience && typeof experience === 'object'
      ? (experience as Record<string, unknown>)
      : null;
  const jobTitle =
    readString(person, ['title', 'jobTitle']) ||
    (experienceRecord
      ? readString(experienceRecord, ['position', 'title', 'jobTitle'])
      : '') ||
    readString(person, ['headline']);
  const headline = readString(person, ['headline', 'title', 'jobTitle']);
  const companyName =
    readString(person, ['company', 'companyName', 'jobCompanyName']) ||
    (experienceRecord
      ? readString(experienceRecord, ['company', 'companyName', 'company_name'])
      : '');
  const location = readString(person, ['location', 'locationName']);
  const resolvedCompanyId =
    readString(person, ['companyId']) || companyId.trim();
  const jobCompanyId = readString(person, ['jobCompanyId']);
  const incomingPositions = Array.isArray(person.current_positions)
    ? person.current_positions
    : Array.isArray(person.currentPositions)
      ? person.currentPositions
      : [];
  const networkDistance = readString(person, [
    'network_distance',
    'networkDistance',
  ]);
  const pendingInvitationRaw =
    person.pending_invitation ?? person.pendingInvitation;
  const recentPostsCount =
    typeof person.recent_posts_count === 'number'
      ? person.recent_posts_count
      : typeof person.recentPostsCount === 'number'
        ? person.recentPostsCount
        : undefined;
  const sharedConnectionsCount =
    typeof person.sharedConnectionsCount === 'number'
      ? person.sharedConnectionsCount
      : typeof person.shared_connections_count === 'number'
        ? person.shared_connections_count
        : undefined;
  const recentlyHiredRaw = person.recently_hired ?? person.recentlyHired;
  const salesNavigatorProfileUrl =
    readString(person, [
      'salesNavigatorProfileUrl',
      'sales_navigator_profile_url',
    ]) ||
    (() => {
      const profileUrl = readString(person, ['profile_url', 'profileUrl']);

      return /linkedin\.com\/sales\//i.test(profileUrl) ? profileUrl : '';
    })();
  const lastOutreachActivity =
    person.last_outreach_activity &&
    typeof person.last_outreach_activity === 'object'
      ? person.last_outreach_activity
      : person.lastOutreachActivity &&
          typeof person.lastOutreachActivity === 'object'
        ? person.lastOutreachActivity
        : undefined;
  const premium =
    typeof person.premium === 'boolean'
      ? person.premium
      : typeof person.isPremium === 'boolean'
        ? person.isPremium
        : undefined;
  const connectionsCount =
    typeof person.connectionsCount === 'number'
      ? person.connectionsCount
      : typeof person.connections_count === 'number'
        ? person.connections_count
        : undefined;
  const followersCount =
    typeof person.followersCount === 'number'
      ? person.followersCount
      : typeof person.followers_count === 'number'
        ? person.followers_count
        : typeof person.follower_count === 'number'
          ? person.follower_count
          : undefined;
  const recruitingActivity = Array.isArray(person.recruitingActivity)
    ? person.recruitingActivity
    : Array.isArray(person.recruiting_activity)
      ? person.recruiting_activity
      : undefined;

  return {
    ...person,
    name,
    firstName,
    lastName,
    first_name: firstName,
    last_name: lastName,
    jobTitle,
    headline,
    company: companyName,
    jobCompanyName: companyName,
    location,
    linkedinUrl,
    profileUrl: linkedinUrl,
    profile_url: salesNavigatorProfileUrl || linkedinUrl,
    public_profile_url: linkedinUrl,
    public_identifier: linkedinProfileId,
    linkedinProfileId,
    profilePictureUrl,
    profile_picture_url: profilePictureUrl,
    displayPicture: profilePictureUrl,
    ...(profilePictureUrlLarge
      ? { profile_picture_url_large: profilePictureUrlLarge }
      : {}),
    ...(summary ? { summary, linkedinSummary: summary } : {}),
    ...(networkDistance ? { network_distance: networkDistance } : {}),
    ...(typeof pendingInvitationRaw === 'boolean'
      ? {
          pending_invitation: pendingInvitationRaw,
          pendingInvitation: pendingInvitationRaw,
        }
      : {}),
    ...(recentPostsCount !== undefined
      ? {
          recent_posts_count: recentPostsCount,
          recentPostsCount,
        }
      : {}),
    ...(typeof recentlyHiredRaw === 'boolean'
      ? {
          recently_hired: recentlyHiredRaw,
          recentlyHired: recentlyHiredRaw,
        }
      : {}),
    ...(salesNavigatorProfileUrl
      ? {
          salesNavigatorProfileUrl,
          sales_navigator_profile_url: salesNavigatorProfileUrl,
        }
      : {}),
    ...(lastOutreachActivity
      ? {
          last_outreach_activity: lastOutreachActivity,
          lastOutreachActivity,
        }
      : {}),
    ...(premium !== undefined ? { premium } : {}),
    ...(connectionsCount !== undefined
      ? {
          connectionsCount,
          connections_count: connectionsCount,
          connectionCount: connectionsCount,
        }
      : {}),
    ...(followersCount !== undefined
      ? {
          followersCount,
          followers_count: followersCount,
          followerCount: followersCount,
        }
      : {}),
    ...(sharedConnectionsCount !== undefined
      ? {
          sharedConnectionsCount,
          shared_connections_count: sharedConnectionsCount,
        }
      : {}),
    ...(recruitingActivity !== undefined
      ? {
          recruitingActivity,
          recruiting_activity: recruitingActivity,
        }
      : {}),
    ...(resolvedCompanyId ? { companyId: resolvedCompanyId } : {}),
    ...(jobCompanyId
      ? { jobCompanyId }
      : resolvedCompanyId
        ? { jobCompanyId: resolvedCompanyId }
        : {}),
    ...(incomingPositions.length > 0
      ? { current_positions: incomingPositions }
      : companyName || jobTitle
        ? {
            current_positions: [
              {
                company: companyName,
                role: jobTitle,
                location,
              },
            ],
          }
        : {}),
  };
};
