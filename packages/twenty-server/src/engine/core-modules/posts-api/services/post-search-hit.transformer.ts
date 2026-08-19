import { Injectable } from '@nestjs/common';

import type { PostSearchHit } from '../posts-api.types';

const readString = (item: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
};

const readNumber = (item: Record<string, unknown>, keys: string[]): number => {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return 0;
};

const readBoolean = (item: Record<string, unknown>, keys: string[]): boolean => {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'boolean') {
      return value;
    }
  }

  return false;
};

const readAuthorName = (item: Record<string, unknown>): string => {
  const author = item.author;
  if (author && typeof author === 'object') {
    return readString(author as Record<string, unknown>, ['name']);
  }

  const writtenBy = item.written_by;
  if (writtenBy && typeof writtenBy === 'object') {
    return readString(writtenBy as Record<string, unknown>, ['name']);
  }

  return '';
};

const readAuthorUrl = (item: Record<string, unknown>): string => {
  const author = item.author;
  if (author && typeof author === 'object') {
    const authorRecord = author as Record<string, unknown>;
    const linkedinUrl = readString(authorRecord, ['linkedinUrl', 'linkedin_url']);
    if (linkedinUrl) {
      return linkedinUrl;
    }

    const publicIdentifier = readString(authorRecord, [
      'public_identifier',
      'publicIdentifier',
    ]);
    const universalName = readString(authorRecord, ['universalName']);
    const identifier = publicIdentifier || universalName || readString(authorRecord, ['id']);
    const isCompany =
      authorRecord.is_company === true ||
      authorRecord.type === 'company' ||
      (!publicIdentifier && Boolean(universalName));

    if (identifier) {
      return isCompany && !identifier.includes('/')
        ? `https://www.linkedin.com/company/${identifier}`
        : `https://www.linkedin.com/in/${identifier}`;
    }
  }

  const writtenBy = item.written_by;
  if (writtenBy && typeof writtenBy === 'object') {
    const identifier = readString(writtenBy as Record<string, unknown>, [
      'public_identifier',
      'id',
    ]);
    if (identifier) {
      return `https://www.linkedin.com/in/${identifier}`;
    }
  }

  return '';
};

@Injectable()
export class PostSearchHitTransformer {
  fromUnipileItems(
    items: Array<{ type?: string } & Record<string, unknown>>,
  ): PostSearchHit[] {
    return items
      .filter((item) => item.type === 'POST')
      .map((item) => this.fromUnipileItem(item));
  }

  fromUnipileItem(item: Record<string, unknown>): PostSearchHit {
    return {
      id: readString(item, ['id']),
      socialId: readString(item, ['social_id', 'socialId']),
      shareUrl: readString(item, ['share_url', 'shareUrl', 'url']),
      title: readString(item, ['title']),
      text: readString(item, ['text']),
      postedAt: readString(item, ['parsed_datetime', 'date', 'postedAt']),
      authorName: readAuthorName(item),
      authorUrl: readAuthorUrl(item),
      reactionCount: readNumber(item, ['reaction_counter', 'reactionCount']),
      commentCount: readNumber(item, ['comment_counter', 'commentCount']),
      isRepost: readBoolean(item, ['is_repost', 'isRepost']),
    };
  }

  fromHarvestItem(item: Record<string, unknown>): PostSearchHit {
    const article =
      item.article && typeof item.article === 'object'
        ? (item.article as Record<string, unknown>)
        : undefined;
    const engagement =
      item.engagement && typeof item.engagement === 'object'
        ? (item.engagement as Record<string, unknown>)
        : undefined;
    const postedAt =
      item.postedAt && typeof item.postedAt === 'object'
        ? (item.postedAt as Record<string, unknown>)
        : undefined;
    const socialContent =
      item.socialContent && typeof item.socialContent === 'object'
        ? (item.socialContent as Record<string, unknown>)
        : undefined;

    return {
      id: readString(item, ['id']),
      socialId: readString(item, ['id', 'repostId']),
      shareUrl:
        readString(item, ['linkedinUrl', 'shareUrl']) ||
        (socialContent ? readString(socialContent, ['shareUrl']) : ''),
      title: article ? readString(article, ['title']) : readString(item, ['title']),
      text: readString(item, ['content', 'text']),
      postedAt: postedAt
        ? readString(postedAt, ['date', 'postedAgoText'])
        : readString(item, ['postedAt', 'date']),
      authorName: readAuthorName(item),
      authorUrl: readAuthorUrl(item),
      reactionCount: engagement
        ? readNumber(engagement, ['likes'])
        : readNumber(item, ['likes', 'reactionCount']),
      commentCount: engagement
        ? readNumber(engagement, ['comments'])
        : readNumber(item, ['comments', 'commentCount']),
      isRepost:
        readBoolean(item, ['is_repost', 'isRepost']) ||
        Boolean(readString(item, ['repostId'])) ||
        Boolean(item.repost) ||
        Boolean(item.repostedBy),
    };
  }
}
