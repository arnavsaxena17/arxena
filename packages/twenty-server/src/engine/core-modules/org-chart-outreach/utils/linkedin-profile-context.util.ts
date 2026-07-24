import type {
    LinkedinCommentSummary,
    LinkedinPostSummary,
    LinkedinProfileSummary,
} from 'src/engine/core-modules/org-chart-outreach/org-chart-outreach.types';

const MAX_SUMMARY_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 200;
const MAX_SKILLS = 15;
const MAX_EXPERIENCE = 4;

type WorkExperienceItem = {
  company?: string;
  position?: string;
  location?: string;
  description?: string;
  start?: string;
  end?: string | null;
};

type SkillItem = {
  name?: string;
};

const truncateText = (value: string | undefined, maxLength: number): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 3)}...`;
};

const readWorkExperience = (profile: Record<string, unknown>): WorkExperienceItem[] => {
  const raw = profile.work_experience;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      company: typeof item.company === 'string' ? item.company : undefined,
      position: typeof item.position === 'string' ? item.position : undefined,
      location: typeof item.location === 'string' ? item.location : undefined,
      description:
        typeof item.description === 'string'
          ? truncateText(item.description, MAX_DESCRIPTION_LENGTH)
          : undefined,
      start: typeof item.start === 'string' ? item.start : undefined,
      end:
        item.end === null || typeof item.end === 'string'
          ? item.end
          : undefined,
    }));
};

const readSkills = (profile: Record<string, unknown>): string[] => {
  const raw = profile.skills;
  if (!Array.isArray(raw)) {
    return [];
  }

  const names = raw
    .map((item) => {
      if (typeof item === 'string') {
        return item.trim();
      }
      if (item && typeof item === 'object' && 'name' in item) {
        const name = (item as SkillItem).name;
        return typeof name === 'string' ? name.trim() : '';
      }
      return '';
    })
    .filter((name) => name.length > 0);

  return names.slice(0, MAX_SKILLS);
};

export const summarizeLinkedinProfile = (
  profile: Record<string, unknown>,
): LinkedinProfileSummary => {
  const experience = readWorkExperience(profile);
  const current = experience[0];

  return {
    publicIdentifier:
      typeof profile.public_identifier === 'string'
        ? profile.public_identifier
        : undefined,
    firstName:
      typeof profile.first_name === 'string' ? profile.first_name : undefined,
    lastName:
      typeof profile.last_name === 'string' ? profile.last_name : undefined,
    headline:
      typeof profile.headline === 'string' ? profile.headline : undefined,
    location:
      typeof profile.location === 'string' ? profile.location : undefined,
    summary: truncateText(
      typeof profile.summary === 'string' ? profile.summary : undefined,
      MAX_SUMMARY_LENGTH,
    ),
    currentRole: current
      ? {
          company: current.company,
          position: current.position,
          location: current.location,
        }
      : undefined,
    recentExperience: experience.slice(0, MAX_EXPERIENCE),
    skills: readSkills(profile),
  };
};

export const summarizeLinkedinPosts = (
  postsPayload: Record<string, unknown> | null | undefined,
  limit = 10,
): LinkedinPostSummary[] => {
  const items = postsPayload?.items;
  if (!Array.isArray(items)) {
    return [];
  }

  const mapped = items
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      text: typeof item.text === 'string' ? item.text.trim() : '',
      parsedDatetime:
        typeof item.parsed_datetime === 'string'
          ? item.parsed_datetime
          : undefined,
      isRepost: item.is_repost === true,
      id: typeof item.id === 'string' ? item.id : undefined,
      socialId: typeof item.social_id === 'string' ? item.social_id : undefined,
      shareUrl: typeof item.share_url === 'string' ? item.share_url : undefined,
    }))
    .filter((item) => item.text.length > 0);

  const originals = mapped.filter((item) => !item.isRepost);
  const reposts = mapped.filter((item) => item.isRepost);
  const ordered = [...originals, ...reposts];

  return ordered.slice(0, limit);
};

export const summarizeLinkedinComments = (
  commentsPayload: Record<string, unknown> | null | undefined,
  limit = 10,
): LinkedinCommentSummary[] => {
  const items = commentsPayload?.items;
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      text: typeof item.text === 'string' ? item.text.trim() : '',
      date: typeof item.date === 'string' ? item.date : undefined,
    }))
    .filter((item) => item.text.length > 0)
    .slice(0, limit);
};

/**
 * Keeps only posts published within the last `days` days (based on Unipile's
 * parsed_datetime). Posts without a parseable date are dropped, since they
 * cannot be verified as recent.
 */
export const filterPostsWithinDays = (
  posts: LinkedinPostSummary[],
  days: number,
  now: Date = new Date(),
): LinkedinPostSummary[] => {
  const cutoffMs = now.getTime() - days * 24 * 60 * 60 * 1000;

  return posts.filter((post) => {
    if (!post.parsedDatetime) {
      return false;
    }
    const postMs = Date.parse(post.parsedDatetime);
    return !Number.isNaN(postMs) && postMs >= cutoffMs;
  });
};

export const buildOutreachProfileContext = (input: {
  senderProfile: Record<string, unknown>;
  targetProfile: Record<string, unknown>;
  postsPayload?: Record<string, unknown> | null;
  commentsPayload?: Record<string, unknown> | null;
  postsLimit?: number;
  commentsLimit?: number;
}): {
  sender: LinkedinProfileSummary;
  target: LinkedinProfileSummary;
  posts: LinkedinPostSummary[];
  comments: LinkedinCommentSummary[];
} => ({
  sender: summarizeLinkedinProfile(input.senderProfile),
  target: summarizeLinkedinProfile(input.targetProfile),
  posts: summarizeLinkedinPosts(input.postsPayload, input.postsLimit ?? 10),
  comments: summarizeLinkedinComments(
    input.commentsPayload,
    input.commentsLimit ?? 10,
  ),
});

export const formatProfileSummaryForPrompt = (
  label: string,
  profile: LinkedinProfileSummary,
): string => {
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  const lines = [
    `${label}:`,
    `- Name: ${name || 'Unknown'}`,
    `- Headline: ${profile.headline ?? 'N/A'}`,
    `- Location: ${profile.location ?? 'N/A'}`,
  ];

  if (profile.currentRole?.company || profile.currentRole?.position) {
    lines.push(
      `- Current role: ${profile.currentRole.position ?? ''} @ ${profile.currentRole.company ?? ''}`.trim(),
    );
  }

  if (profile.summary) {
    lines.push(`- Summary: ${profile.summary}`);
  }

  if (profile.recentExperience.length > 0) {
    lines.push('- Recent experience:');
    for (const role of profile.recentExperience) {
      lines.push(
        `  • ${role.position ?? ''} @ ${role.company ?? ''} (${role.start ?? '?'} – ${role.end ?? 'present'})`,
      );
    }
  }

  if (profile.skills.length > 0) {
    lines.push(`- Skills: ${profile.skills.join(', ')}`);
  }

  return lines.join('\n');
};

export const formatPostsForPrompt = (posts: LinkedinPostSummary[]): string => {
  if (posts.length === 0) {
    return 'No recent posts available.';
  }

  return posts
    .map(
      (post, index) =>
        `${index + 1}. [${post.isRepost ? 'repost' : 'original'}${post.parsedDatetime ? `, ${post.parsedDatetime}` : ''}] ${post.text}`,
    )
    .join('\n');
};

export const formatCommentsForPrompt = (
  comments: LinkedinCommentSummary[],
): string => {
  if (comments.length === 0) {
    return 'No recent comments available.';
  }

  return comments
    .map(
      (comment, index) =>
        `${index + 1}. [${comment.date ?? 'unknown date'}] ${comment.text}`,
    )
    .join('\n');
};

export const extractTargetProviderId = (
  targetProfile: Record<string, unknown>,
  fallbackIdentifier: string,
): string => {
  if (typeof targetProfile.provider_id === 'string') {
    return targetProfile.provider_id.trim();
  }
  return fallbackIdentifier.trim();
};
