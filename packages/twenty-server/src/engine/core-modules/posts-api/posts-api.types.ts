import type { PostDataSourceAlias } from './constants/post-data-source-aliases';

export type PostSearchHit = {
  id: string;
  socialId: string;
  shareUrl: string;
  title: string;
  text: string;
  postedAt: string;
  authorName: string;
  authorUrl: string;
  reactionCount: number;
  commentCount: number;
  isRepost: boolean;
};

export type PostSearchResponse = {
  status: 'ok';
  dataSource: Exclude<PostDataSourceAlias, 'auto'>;
  total: number;
  items: PostSearchHit[];
};

export type PostDataSourcesStatusResponse = {
  status: 'ok';
  sources: Array<{
    alias: PostDataSourceAlias;
    label: string;
    description: string;
    configured: boolean;
  }>;
};
