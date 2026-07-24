import styled from '@emotion/styled';

import { Modal } from '@/ui/layout/modal/components/Modal';

/**
 * Default org chart modals: {@link Modal.Header} is fixed 60px tall;
 * {@link Modal.Content} uses very large padding (spacing(10)). These variants
 * sit the title closer to the body for a single visual block.
 */
export const OrgChartModalTightHeader = styled(Modal.Header)`
  && {
    height: auto;
    min-height: 0;
    padding: ${({ theme }) => theme.spacing(3)}
      ${({ theme }) => theme.spacing(5)} ${({ theme }) => theme.spacing(2)};
  }
`;

export const OrgChartModalTightContent = styled(Modal.Content)`
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(5)}
    ${({ theme }) => theme.spacing(4)};
`;
