'use client';

import styled from '@emotion/styled';
import { useMemo } from 'react';
import { applyCalendlyInlineEmbedParams } from 'twenty-shared';

const CALENDLY_INLINE_HEIGHT_PX = 620;

const StyledEmbedWrap = styled.div`
  width: 100%;
  min-height: ${CALENDLY_INLINE_HEIGHT_PX}px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(20, 20, 20, 0.08);
  background: #fafafa;
`;

const StyledCalendlyFrame = styled.iframe`
  background: #fafafa;
  border: 0;
  display: block;
  height: ${CALENDLY_INLINE_HEIGHT_PX}px;
  width: 100%;
`;

type CalendlyInlineProps = {
  url: string;
};

export const CalendlyInline = ({ url }: CalendlyInlineProps) => {
  const embedUrl = useMemo(() => applyCalendlyInlineEmbedParams(url), [url]);

  return (
    <StyledEmbedWrap>
      <StyledCalendlyFrame
        src={embedUrl}
        title="Schedule a call with Arxena"
      />
    </StyledEmbedWrap>
  );
};
