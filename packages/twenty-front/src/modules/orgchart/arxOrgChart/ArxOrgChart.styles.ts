import styled from '@emotion/styled';
import { Button } from 'twenty-ui';

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

export const StyledPreviewBannerSignupButton = styled(Button)`
  justify-content: center;
`;

export const StyledSearchOverlay = styled.div`
  position: absolute;
  bottom: ${({ theme }) => theme.spacing(2)};
  left: ${({ theme }) => theme.spacing(2)};
  z-index: 20;
`;

export const StyledTopRightActionsOverlay = styled.div`
  position: absolute;
  top: ${({ theme }) => theme.spacing(2)};
  left: ${({ theme }) => theme.spacing(2)};
  right: ${({ theme }) => theme.spacing(2)};
  z-index: 20;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: start;
  pointer-events: none;
`;

export const StyledTopRightActionButton = styled(Button)`
  justify-content: center;
  pointer-events: auto;
`;

export const StyledTopRightActionsRightGroup = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
  justify-content: flex-end;
  pointer-events: auto;
`;

export const StyledTopRightActionsCenterGroup = styled.div`
  display: flex;
  justify-content: center;
  pointer-events: auto;
`;

export const StyledAsOfMonthPicker = styled.div`
  align-items: center;
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.md};
  box-shadow: ${({ theme }) => theme.boxShadow.light};
  display: inline-flex;
  gap: ${({ theme }) => theme.spacing(1)};
  height: 32px;
  padding: 0 ${({ theme }) => theme.spacing(1)};
`;

export const StyledAsOfMonthLabel = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  white-space: nowrap;
`;

export const StyledAsOfMonthInput = styled.input`
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  height: 26px;
  padding: 0 ${({ theme }) => theme.spacing(1)};
`;

export const StyledAsOfMonthSliderContainer = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  max-width: 320px;
`;

export const StyledAsOfMonthSliderTimeline = styled.div`
  display: inline-flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(0.5)};
`;

export const StyledAsOfMonthSlider = styled.input`
  width: 240px;
  cursor: pointer;
`;

export const StyledAsOfMonthSliderRangeLabels = styled.div`
  display: flex;
  justify-content: space-between;
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
`;

export const StyledAsOfMonthSliderValue = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  min-width: 68px;
  text-align: right;
`;

export const StyledAsOfMonthSliderDot = styled.div`
  width: ${({ theme }) => theme.spacing(2)};
  height: ${({ theme }) => theme.spacing(2)};
  border-radius: 50%;
  background: ${({ theme }) => theme.color.blue};
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

export const StyledLeadershipBannerLink = styled(Button)`
  align-items: baseline;
  display: inline-flex;
  height: auto;
  padding: 0;
  gap: 0;
  justify-content: flex-start;
  text-decoration: underline;
  text-underline-offset: 2px;
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

export const StyledTemplateBannerButton = styled(Button)`
  justify-content: center;
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

