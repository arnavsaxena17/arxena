'use client';
import styled from '@emotion/styled';
import { ContentContainer } from './_components/ui/layout/ContentContainer';
import { useEffect } from 'react';

export const dynamic = 'force-dynamic';
const IframeContainer = styled.div`
  margin: -96px -96px;
  height: 100vh;
  @media (max-width: 809px) {
    margin: -24px -24px;
  }
`;

function WebflowEmbed() {

  return (
    <IframeContainer>
      <iframe
        src="api/webflow-proxy"
        width="100%"
        height="100%"
        style={{
          width: '100%',
          height: '100%',
          border: 'none'
        }}
        frameBorder="0"
        allowFullScreen
      />
    </IframeContainer>
  );
}

export default function Home() {
  return (
    <ContentContainer>
      <WebflowEmbed />
    </ContentContainer>
  );
}