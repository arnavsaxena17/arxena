import { isNonEmptyString } from '@sniptt/guards';

import { summarizeLinkedinPosts } from 'src/engine/core-modules/org-chart-outreach/utils/linkedin-profile-context.util';

export type NormalizedLinkedinActivityPost = {
  id?: string;
  socialId?: string;
  text: string;
  parsedDatetime?: string;
  shareUrl?: string;
  isRepost: boolean;
};

export type NormalizedLinkedinActivityComment = {
  id?: string;
  postId?: string;
  text: string;
  date?: string;
};

export const normalizeLinkedinActivityPosts = (
  postsPayload: Record<string, unknown> | null | undefined,
  limit: number,
): NormalizedLinkedinActivityPost[] =>
  summarizeLinkedinPosts(postsPayload, limit).map((post) => ({
    id: post.id,
    socialId: post.socialId,
    text: post.text,
    parsedDatetime: post.parsedDatetime,
    shareUrl: post.shareUrl,
    isRepost: post.isRepost,
  }));

export const normalizeLinkedinActivityUserComments = (
  commentsPayload: Record<string, unknown> | null | undefined,
  limit: number,
): NormalizedLinkedinActivityComment[] => {
  const items = commentsPayload?.items;

  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === 'object',
    )
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : undefined,
      postId:
        typeof item.post_id === 'string'
          ? item.post_id
          : typeof item.post_urn === 'string'
            ? item.post_urn
            : undefined,
      text: typeof item.text === 'string' ? item.text.trim() : '',
      date: typeof item.date === 'string' ? item.date : undefined,
    }))
    .filter((item) => item.text.length > 0)
    .slice(0, limit);
};

// Prefer newest original post; fall back to newest of any post, then first item.
export const pickMostRecentLinkedinActivityPost = (
  posts: NormalizedLinkedinActivityPost[],
): NormalizedLinkedinActivityPost | null => {
  if (posts.length === 0) {
    return null;
  }

  const byDatetimeDescending = (
    left: NormalizedLinkedinActivityPost,
    right: NormalizedLinkedinActivityPost,
  ) => {
    const leftMs = left.parsedDatetime
      ? Date.parse(left.parsedDatetime)
      : Number.NaN;
    const rightMs = right.parsedDatetime
      ? Date.parse(right.parsedDatetime)
      : Number.NaN;
    const leftRank = Number.isNaN(leftMs) ? 0 : leftMs;
    const rightRank = Number.isNaN(rightMs) ? 0 : rightMs;

    return rightRank - leftRank;
  };

  const originals = posts.filter((post) => post.isRepost !== true);
  const pool = originals.length > 0 ? originals : posts;
  const sorted = [...pool].sort(byDatetimeDescending);

  return sorted[0] ?? posts[0] ?? null;
};

export const hasCommentableSocialId = (
  post: NormalizedLinkedinActivityPost | null,
): boolean => isNonEmptyString(post?.socialId);
