'use client';

import styled from '@emotion/styled';
import { useEffect, useMemo } from 'react';
import { applyCalendlyInlineEmbedParams } from 'twenty-shared/utils';

const CALENDLY_PRECONNECT_ORIGINS = [
  'https://calendly.com',
  'https://assets.calendly.com',
] as const;

const ensureCalendlyPreconnect = (): void => {
  if (typeof document === 'undefined') {
    return;
  }

  CALENDLY_PRECONNECT_ORIGINS.forEach((origin) => {
    const selector = `link[data-calendly-preconnect="${origin}"]`;
    if (document.head.querySelector(selector)) {
      return;
    }

    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    link.crossOrigin = 'anonymous';
    link.setAttribute('data-calendly-preconnect', origin);
    document.head.appendChild(link);
  });
};

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

  useEffect(() => {
    ensureCalendlyPreconnect();
  }, []);

  return (
    <StyledEmbedWrap>
      <StyledCalendlyFrame
        src={embedUrl}
        title="Schedule a call with Arxena"
        loading="eager"
      />
    </StyledEmbedWrap>
  );
};
