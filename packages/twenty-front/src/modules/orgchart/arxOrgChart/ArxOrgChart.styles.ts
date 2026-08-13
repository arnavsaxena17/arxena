import { Button } from 'twenty-ui';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

export const StyledContainer = styled.div`
  background: ${themeCssVariables.background.primary};
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
  min-height: 400px;
`;

export const StyledDiagramArea = styled.div`
  background: ${themeCssVariables.background.secondary};
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 300px;
  position: relative;
`;

export const StyledDiagramBody = styled.div`
  flex: 1;
  min-height: 0;
  position: relative;
`;

export const StyledPreviewPersistentBanner = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.tertiary};
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  color: ${themeCssVariables.font.color.primary};
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
  justify-content: center;
  padding: ${themeCssVariables.spacing[1.5]}
    ${themeCssVariables.spacing[2]};
  text-align: center;
`;

export const StyledPreviewBannerSignupButton = styled(Button)`
  justify-content: center;
`;

export const StyledSearchOverlay = styled.div`
  bottom: ${themeCssVariables.spacing[2]};
  left: ${themeCssVariables.spacing[2]};
  position: absolute;
  z-index: 20;
`;

export const StyledTopRightActionsOverlay = styled.div`
  align-items: start;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  left: ${themeCssVariables.spacing[2]};
  pointer-events: none;
  position: absolute;
  right: ${themeCssVariables.spacing[2]};
  top: ${themeCssVariables.spacing[2]};
  z-index: 20;
`;

export const StyledTopRightActionButton = styled(Button)`
  justify-content: center;
  pointer-events: auto;
`;

export const StyledTopRightActionsRightGroup = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
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
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  box-shadow: ${themeCssVariables.boxShadow.light};
  display: inline-flex;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing['0.5']} ${themeCssVariables.spacing[1]};
`;

export const StyledAsOfMonthLabel = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  white-space: nowrap;
`;

export const StyledAsOfMonthInput = styled.input`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  height: 26px;
  padding: 0 ${themeCssVariables.spacing[1]};
`;

export const StyledAsOfMonthSliderContainer = styled.div`
  display: inline-flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[0.5]};
  max-width: 320px;
`;

export const StyledAsOfMonthSliderMainRow = styled.div`
  align-items: center;
  display: inline-flex;
  gap: ${themeCssVariables.spacing[1]};
`;

export const StyledAsOfMonthSliderTimeline = styled.div`
  display: inline-flex;
  flex-direction: column;
`;

export const StyledAsOfMonthSlider = styled.input`
  cursor: pointer;
  width: 240px;
`;

export const StyledAsOfMonthSliderRangeLabels = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  font-size: ${themeCssVariables.font.size.xs};
  justify-content: space-between;
  padding-left: ${themeCssVariables.spacing[5]};
  padding-right: ${themeCssVariables.spacing[9]};
`;

export const StyledAsOfMonthSliderValue = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  min-width: 68px;
  text-align: right;
`;

export const StyledAsOfMonthSliderDot = styled.div`
  background: ${themeCssVariables.color.blue};
  border-radius: 50%;
  height: ${themeCssVariables.spacing[2]};
  width: ${themeCssVariables.spacing[2]};
`;

export const StyledLoadingMessage = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  font-size: ${themeCssVariables.font.size.md};
  height: 100%;
  justify-content: center;
  min-height: 300px;
`;

export const StyledProgressBanner = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.tertiary};
  border-radius: ${themeCssVariables.border.radius.md};
  box-shadow: ${themeCssVariables.boxShadow.light};
  color: ${themeCssVariables.font.color.primary};
  display: flex;
  flex-direction: column;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[0.5]};
  left: 50%;
  max-width: min(720px, calc(100% - ${themeCssVariables.spacing[4]}));
  padding: ${themeCssVariables.spacing[1.5]}
    ${themeCssVariables.spacing[2]};
  position: absolute;
  text-align: center;
  top: ${themeCssVariables.spacing[2]};
  transform: translateX(-50%);
  z-index: 25;
`;

export const StyledProgressElapsed = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
`;

export const StyledProgressCancelRow = styled.div`
  margin-top: ${themeCssVariables.spacing[1]};
`;

export const StyledLeadershipLoadingOverlay = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.secondary};
  color: ${themeCssVariables.font.color.primary};
  display: flex;
  flex-direction: column;
  font-size: ${themeCssVariables.font.size.md};
  gap: ${themeCssVariables.spacing[2]};
  inset: 0;
  justify-content: center;
  padding: ${themeCssVariables.spacing[3]};
  position: absolute;
  text-align: center;
  z-index: 30;
`;

export const StyledLeadershipInfoBanner = styled.div`
  background: ${themeCssVariables.background.tertiary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  box-shadow: ${themeCssVariables.boxShadow.light};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  left: ${themeCssVariables.spacing[2]};
  line-height: 1.45;
  max-width: min(560px, calc(100% - 220px));
  padding: ${themeCssVariables.spacing[1.5]}
    ${themeCssVariables.spacing[2]};
  position: absolute;
  top: ${themeCssVariables.spacing[2]};
  z-index: 22;
`;

export const StyledLeadershipBannerLink = styled(Button)`
  align-items: baseline;
  display: inline-flex;
  gap: 0;
  height: auto;
  justify-content: flex-start;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
`;

export const StyledLeadershipBannerPaidNote = styled.div`
  border-top: 1px dashed ${themeCssVariables.border.color.medium};
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.xs};
  line-height: 1.45;
  margin-top: ${themeCssVariables.spacing[1]};
  padding-top: ${themeCssVariables.spacing[1]};
`;

export const StyledLeadershipBannerPaidHighlight = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-weight: 600;
`;

export const StyledErrorMessage = styled.div`
  align-items: center;
  color: ${themeCssVariables.color.red};
  display: flex;
  font-size: ${themeCssVariables.font.size.md};
  height: 100%;
  justify-content: center;
  min-height: 300px;
`;

export const StyledTemplateBanner = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.xl};
  box-shadow: ${themeCssVariables.boxShadow.strong};
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  flex-direction: column;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
  left: 50%;
  max-width: 420px;
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
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
  animation: orgchart-spin 0.8s linear infinite;
  border: 2px solid ${themeCssVariables.border.color.medium};
  border-radius: 50%;
  border-top-color: ${themeCssVariables.color.blue};
  height: 24px;
  width: 24px;

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
  align-self: stretch;
  max-width: 100%;
  text-align: left;
  width: 100%;
`;

export const StyledOrgChartConfirmIntro = styled.p`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.5;
  margin: 0 0 ${themeCssVariables.spacing[2]};
`;

export const StyledOrgChartConfirmRows = styled.dl`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1.5]};
  margin: 0;
`;

export const StyledOrgChartConfirmRow = styled.div`
  align-items: start;
  display: grid;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
  grid-template-columns: minmax(120px, 36%) 1fr;
`;

export const StyledOrgChartConfirmDt = styled.dt`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: 600;
  letter-spacing: 0.03em;
  margin: 0;
  text-transform: uppercase;
`;

export const StyledOrgChartConfirmDd = styled.dd`
  color: ${themeCssVariables.font.color.primary};
  margin: 0;
  word-break: break-word;
`;

