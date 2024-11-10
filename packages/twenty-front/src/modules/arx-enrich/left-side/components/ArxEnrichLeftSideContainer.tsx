import styled from '@emotion/styled';

import { ModalNavElementContainer } from '@/arx-enrich/left-side/components/ai-interview-modal-nav-container/ModalNavElementContainer';

const StyledContainer = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  display: flex;
  flex-direction: column;
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  gap: 32px;
  padding: 44px 32px 44px 32px;
  width: calc(100% * (1 / 3));
  max-width: 300px;
  min-width: 224px;
  flex-shrink: 1;
`;

export const ArxEnrichLeftSideContainer = () => {
  return (
    <StyledContainer>
      <div>New ARX Enrich</div>
      <ModalNavElementContainer />
    </StyledContainer>
  );
};
