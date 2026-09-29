import { isNonEmptyString } from '@sniptt/guards';

import {
  pickMostRecentLinkedinActivityPost,
  type NormalizedLinkedinActivityPost,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/normalize-linkedin-activity.util';

export type PersonLinkedinPostsField = {
  fetchedAt: string;
  posts: unknown[];
  mostRecentPost: unknown;
};

const postMergeKey = (post: unknown): string | null => {
  if (!post || typeof post !== 'object') {
    return null;
  }

  const record = post as Record<string, unknown>;
  const socialId =
    typeof record.socialId === 'string' ? record.socialId.trim() : '';
  if (isNonEmptyString(socialId)) {
    return `social:${socialId}`;
  }

  const id = typeof record.id === 'string' ? record.id.trim() : '';
  if (isNonEmptyString(id)) {
    return `id:${id}`;
  }

  return null;
};

const parsePostDatetimeMs = (post: unknown): number => {
  if (!post || typeof post !== 'object') {
    return 0;
  }

  const parsedDatetime = (post as Record<string, unknown>).parsedDatetime;
  if (typeof parsedDatetime !== 'string' || !parsedDatetime.trim()) {
    return 0;
  }

  const parsedMs = Date.parse(parsedDatetime);
  return Number.isNaN(parsedMs) ? 0 : parsedMs;
};

// Union existing person.linkedinPosts with a fresh fetch; incoming wins on
// key collision. Sorted newest-first so drafting sees recent activity first.
export const mergePersonLinkedinPostsField = ({
  existing,
  incomingPosts,
  incomingMostRecentPost,
}: {
  existing: unknown;
  incomingPosts: unknown[];
  incomingMostRecentPost: unknown;
}): PersonLinkedinPostsField => {
  const existingRecord =
    existing && typeof existing === 'object'
      ? (existing as Record<string, unknown>)
      : null;
  const existingPosts = Array.isArray(existingRecord?.posts)
    ? existingRecord.posts
    : [];

  const byKey = new Map<string, unknown>();
  let unkeyedIndex = 0;

  for (const post of [...existingPosts, ...incomingPosts]) {
    const key = postMergeKey(post) ?? `unkeyed:${unkeyedIndex++}`;
    byKey.set(key, post);
  }

  const posts = [...byKey.values()].sort(
    (left, right) => parsePostDatetimeMs(right) - parsePostDatetimeMs(left),
  );

  const normalizedForPick = posts.filter(
    (post): post is NormalizedLinkedinActivityPost =>
      !!post &&
      typeof post === 'object' &&
      typeof (post as Record<string, unknown>).text === 'string',
  ) as NormalizedLinkedinActivityPost[];

  const mostRecentPost =
    incomingMostRecentPost ??
    pickMostRecentLinkedinActivityPost(normalizedForPick) ??
    posts[0] ??
    null;

  return {
    fetchedAt: new Date().toISOString(),
    posts,
    mostRecentPost,
  };
};
