import { OBJECT_SETTINGS_WIDTH } from '@/settings/data-model/constants/ObjectSettings';
import { useIsMobile } from '@/ui/utilities/responsive/hooks/useIsMobile';
import { ScrollWrapper } from '@/ui/utilities/scroll/components/ScrollWrapper';
import styled from '@emotion/styled';
import { ReactNode } from 'react';
import { isDefined } from 'twenty-shared';

const StyledSettingsPageScrollWrapper = styled(ScrollWrapper)`
  display: flex;
  flex: 1;
  min-height: 0;
`;

const StyledSettingsPageContainer = styled.div<{
  width?: number;
  fullWidth?: boolean;
}>`
  display: ${({ fullWidth }) => (fullWidth ? 'grid' : 'flex')};
  ${({ fullWidth, theme }) =>
    fullWidth
      ? `
    grid-template-columns: minmax(0, 1fr);
    grid-auto-rows: min-content;
    row-gap: ${theme.spacing(8)};
    max-width: 100%;
    min-width: 0;
  `
      : `
    flex-direction: column;
    gap: ${theme.spacing(8)};
  `}
  overflow: visible;
  padding: ${({ theme }) => theme.spacing(6, 8, 8)};
  min-height: 100%;
  width: ${({ width, fullWidth }) => {
    if (fullWidth) {
      return '100%';
    }
    if (isDefined(width)) {
      return width + 'px';
    }
    if (useIsMobile()) {
      return 'unset';
    }
    return OBJECT_SETTINGS_WIDTH + 'px';
  }};
  padding-bottom: ${({ theme }) => theme.spacing(20)};
`;

export const SettingsPageContainer = ({
  children,
  fullWidth,
}: {
  children: ReactNode;
  fullWidth?: boolean;
}) => (
  <StyledSettingsPageScrollWrapper
    contextProviderName="settingsPageContainer"
    componentInstanceId={'scroll-wrapper-settings-page-container'}
  >
    <StyledSettingsPageContainer fullWidth={fullWidth}>
      {children}
    </StyledSettingsPageContainer>
  </StyledSettingsPageScrollWrapper>
);
