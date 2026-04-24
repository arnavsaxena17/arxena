import styled from '@emotion/styled';

export const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
  min-height: 400px;
  background: ${({ theme }) => theme.background.primary};
`;

export const StyledDiagramArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  min-height: 300px;
  background: ${({ theme }) => theme.background.secondary};
`;

export const StyledDiagramBody = styled.div`
  flex: 1;
  min-height: 0;
  position: relative;
`;

export const StyledPreviewPersistentBanner = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(1.5)}
    ${({ theme }) => theme.spacing(2)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.tertiary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  text-align: center;
`;

export const StyledPreviewBannerSignupButton = styled.button`
  padding: ${({ theme }) => theme.spacing(0.75)}
    ${({ theme }) => theme.spacing(1.5)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: none;
  background: ${({ theme }) => theme.accent.primary};
  color: ${({ theme }) => theme.font.color.inverted};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    opacity: 0.92;
  }

  &:active {
    opacity: 0.85;
  }
`;

export const StyledSearchOverlay = styled.div`
  position: absolute;
  bottom: ${({ theme }) => theme.spacing(2)};
  left: ${({ theme }) => theme.spacing(2)};
  z-index: 20;
`;

export const StyledTopRightActionsOverlay = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
  position: absolute;
  right: ${({ theme }) => theme.spacing(2)};
  top: ${({ theme }) => theme.spacing(2)};
  z-index: 20;
`;

export const StyledTopRightActionButton = styled.button`
  padding: ${({ theme }) => theme.spacing(1)}
    ${({ theme }) => theme.spacing(1.5)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.xs};
  cursor: pointer;

  &:hover:enabled {
    background: ${({ theme }) => theme.background.transparent.light};
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;

export const StyledLoadingMessage = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.tertiary};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.md};
  height: 100%;
  justify-content: center;
  min-height: 300px;
`;

export const StyledProgressBanner = styled.div`
  background: ${({ theme }) => theme.background.tertiary};
  border-radius: ${({ theme }) => theme.border.radius.md};
  box-shadow: ${({ theme }) => theme.boxShadow.light};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  left: 50%;
  max-width: min(720px, calc(100% - ${({ theme }) => theme.spacing(4)}));
  padding: ${({ theme }) => theme.spacing(1.5)}
    ${({ theme }) => theme.spacing(2)};
  position: absolute;
  text-align: center;
  top: ${({ theme }) => theme.spacing(2)};
  transform: translateX(-50%);
  z-index: 25;
`;

export const StyledLeadershipLoadingOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing(2)};
  background: ${({ theme }) => theme.background.secondary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  text-align: center;
  padding: ${({ theme }) => theme.spacing(3)};
`;

export const StyledLeadershipInfoBanner = styled.div`
  background: ${({ theme }) => theme.background.tertiary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  box-shadow: ${({ theme }) => theme.boxShadow.light};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  left: ${({ theme }) => theme.spacing(2)};
  line-height: 1.45;
  max-width: min(560px, calc(100% - 220px));
  padding: ${({ theme }) => theme.spacing(1.5)}
    ${({ theme }) => theme.spacing(2)};
  position: absolute;
  top: ${({ theme }) => theme.spacing(2)};
  z-index: 22;
`;

export const StyledLeadershipBannerLink = styled.button`
  display: inline;
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  color: ${({ theme }) => theme.color.blue};
  font-size: inherit;
  font-family: inherit;
  line-height: inherit;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;

  &:hover {
    opacity: 0.9;
  }
`;

export const StyledLeadershipBannerPaidNote = styled.div`
  border-top: 1px dashed ${({ theme }) => theme.border.color.medium};
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.xs};
  line-height: 1.45;
  margin-top: ${({ theme }) => theme.spacing(1)};
  padding-top: ${({ theme }) => theme.spacing(1)};
`;

export const StyledLeadershipBannerPaidHighlight = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-weight: 600;
`;

export const StyledErrorMessage = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.color.red};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.md};
  height: 100%;
  justify-content: center;
  min-height: 300px;
`;

export const StyledTemplateBanner = styled.div`
  align-items: center;
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.xl};
  box-shadow: ${({ theme }) => theme.boxShadow.strong};
  color: ${({ theme }) => theme.font.color.secondary};
  display: flex;
  flex-direction: column;
  font-size: ${({ theme }) => theme.font.size.sm};
  gap: ${({ theme }) => theme.spacing(2)};
  left: 50%;
  max-width: 420px;
  padding: ${({ theme }) => theme.spacing(3)} ${({ theme }) => theme.spacing(4)};
  position: absolute;
  text-align: center;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 25;
`;

export const StyledTemplateBannerButton = styled.button`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.md};
  border: none;
  background: ${({ theme }) => theme.background.invertedPrimary};
  color: ${({ theme }) => theme.font.color.inverted};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
  transition: opacity 0.15s ease;

  &:hover {
    opacity: 0.9;
  }

  &:active {
    opacity: 0.8;
  }
`;

export const StyledSpinner = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid ${({ theme }) => theme.border.color.medium};
  border-top-color: ${({ theme }) => theme.color.blue};
  animation: orgchart-spin 0.8s linear infinite;

  @keyframes orgchart-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

export const StyledOrgChartConfirmSummary = styled.div`
  width: 100%;
  max-width: 100%;
  text-align: left;
  align-self: stretch;
`;

export const StyledOrgChartConfirmIntro = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.sm};
  line-height: 1.5;
  color: ${({ theme }) => theme.font.color.secondary};
`;

export const StyledOrgChartConfirmRows = styled.dl`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1.5)};
  margin: 0;
`;

export const StyledOrgChartConfirmRow = styled.div`
  align-items: start;
  display: grid;
  font-size: ${({ theme }) => theme.font.size.sm};
  gap: ${({ theme }) => theme.spacing(2)};
  grid-template-columns: minmax(120px, 36%) 1fr;
`;

export const StyledOrgChartConfirmDt = styled.dt`
  margin: 0;
  color: ${({ theme }) => theme.font.color.tertiary};
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-size: ${({ theme }) => theme.font.size.xs};
`;

export const StyledOrgChartConfirmDd = styled.dd`
  margin: 0;
  color: ${({ theme }) => theme.font.color.primary};
  word-break: break-word;
`;

