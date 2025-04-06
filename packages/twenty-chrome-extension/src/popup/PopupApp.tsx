import styled from '@emotion/styled';

const StyledWrapper = styled.div`
  align-items: center;
  background: white;
  display: flex;
  height: 500px;
  justify-content: center;
  width: 100vw;
  max-width: 400px;
`;

const StyledContainer = styled.div`
  width: 100vw;
  height: 500px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const StyledHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
`;

const StyledTitle = styled.h1`
  font-size: 18px;
  margin: 0;
`;

const PopupApp = () => {
  console.log('PopupApp rendered');
  return (
    <StyledWrapper>
      <StyledContainer>
        <StyledHeader>
          <StyledTitle>Arxena</StyledTitle>
        </StyledHeader>
        <p>The extension is not working correctly!</p>
      </StyledContainer>
    </StyledWrapper>
  );
};

export default PopupApp; 