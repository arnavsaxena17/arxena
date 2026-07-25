
import { Modal } from '@/ui/layout/modal/components/Modal';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

/**
 * Default org chart modals: {@link Modal.Header} is fixed 60px tall;
 * {@link Modal.Content} uses very large padding (spacing(10)). These variants
 * sit the title closer to the body for a single visual block.
 */
export const OrgChartModalTightHeader = styled(Modal.Header)`
  && {
    height: auto;
    min-height: 0;
    padding: ${themeCssVariables.spacing[3]}
      ${themeCssVariables.spacing[5]} ${themeCssVariables.spacing[2]};
  }
`;

export const OrgChartModalTightContent = styled(Modal.Content)`
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[5]}
    ${themeCssVariables.spacing[4]};
`;
