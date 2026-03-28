'use client';

import styled from '@emotion/styled';
import Script from 'next/script';

const StyledEmbedWrap = styled.div`
  width: 100%;
  min-height: 700px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(20, 20, 20, 0.08);
  background: #fafafa;
`;

type CalendlyInlineProps = {
  url: string;
};

export const CalendlyInline = ({ url }: CalendlyInlineProps) => {
  return (
    <>
      <Script
        src="https://assets.calendly.com/assets/external/widget.js"
        strategy="lazyOnload"
      />
      <StyledEmbedWrap>
        <div
          className="calendly-inline-widget"
          data-url={url}
          style={{ minWidth: '320px', height: '700px' }}
        />
      </StyledEmbedWrap>
    </>
  );
};
