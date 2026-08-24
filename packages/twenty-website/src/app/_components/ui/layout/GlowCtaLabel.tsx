'use client';

import styled from '@emotion/styled';

// Renders the label as plain white text everywhere (safe default), then
// progressively enhances to an image-filled label on browsers that support
// background-clip: text — the image itself carries a Rec.2020/PQ ICC
// profile (same technique verified to survive a re-encode on the logo
// files), so it should render brighter-than-SDR-white on an HDR display
// instead of just being plain white like the CSS-only attempt was.
export const GlowCtaLabel = styled.span`
  color: #fff;
  transition:
    color 0.15s ease,
    opacity 0.15s ease;

  @supports (background-clip: text) or (-webkit-background-clip: text) {
    display: inline-block;
    background-image: url('/images/core/hdr-white-swatch.jpg');
    background-size: cover;
    background-position: center;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    -webkit-text-fill-color: transparent;
  }
`;
