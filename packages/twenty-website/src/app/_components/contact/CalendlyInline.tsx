'use client';

import styled from '@emotion/styled';

const StyledEmbedWrap = styled.div`
  width: 100%;
  min-height: 700px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(20, 20, 20, 0.08);
  background: #fafafa;
`;

const StyledCalendlyFrame = styled.iframe`
  background: #fafafa;
  border: 0;
  display: block;
  height: 700px;
  width: 100%;
`;

type CalendlyInlineProps = {
  url: string;
};

export const CalendlyInline = ({ url }: CalendlyInlineProps) => {
  return (
    <StyledEmbedWrap>
      <StyledCalendlyFrame
        src={url}
        title="Schedule a call with Arxena"
      />
    </StyledEmbedWrap>
  );
};
