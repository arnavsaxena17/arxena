'use client';
import dynamic from 'next/dynamic';

const GraphQlPlayground = dynamic(
  () => import('../../../_components/playground/graphql-playground'),
  { ssr: true },
);

const CoreGraphql = () => {
  return <GraphQlPlayground subDoc={'core'} />;
};

export default CoreGraphql;
