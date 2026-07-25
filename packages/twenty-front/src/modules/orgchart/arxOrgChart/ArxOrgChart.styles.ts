import { Button } from 'twenty-ui';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

export const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
  min-height: 400px;
  background: ${themeCssVariables.background.primary};
`;

export const StyledDiagramArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  min-height: 300px;
  background: ${themeCssVariables.background.secondary};
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
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[1.5]}
    ${themeCssVariables.spacing[2]};
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.tertiary};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  text-align: center;
`;

export const StyledPreviewBannerSignupButton = styled(Button)`
  justify-content: center;
`;

export const StyledSearchOverlay = styled.div`
  position: absolute;
  bottom: ${themeCssVariables.spacing[2]};
  left: ${themeCssVariables.spacing[2]};
  z-index: 20;
`;

export const StyledTopRightActionsOverlay = styled.div`
  position: absolute;
  top: ${themeCssVariables.spacing[2]};
  left: ${themeCssVariables.spacing[2]};
  right: ${themeCssVariables.spacing[2]};
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
  width: 240px;
  cursor: pointer;
`;

export const StyledAsOfMonthSliderRangeLabels = styled.div`
  display: flex;
  justify-content: space-between;
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
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
  width: ${themeCssVariables.spacing[2]};
  height: ${themeCssVariables.spacing[2]};
  border-radius: 50%;
  background: ${themeCssVariables.color.blue};
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
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${themeCssVariables.spacing[2]};
  background: ${themeCssVariables.background.secondary};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  text-align: center;
  padding: ${themeCssVariables.spacing[3]};
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
  height: auto;
  padding: 0;
  gap: 0;
  justify-content: flex-start;
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
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid ${themeCssVariables.border.color.medium};
  border-top-color: ${themeCssVariables.color.blue};
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
  margin: 0 0 ${themeCssVariables.spacing[2]};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.5;
  color: ${themeCssVariables.font.color.secondary};
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
  margin: 0;
  color: ${themeCssVariables.font.color.tertiary};
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-size: ${themeCssVariables.font.size.xs};
`;

export const StyledOrgChartConfirmDd = styled.dd`
  margin: 0;
  color: ${themeCssVariables.font.color.primary};
  word-break: break-word;
`;

