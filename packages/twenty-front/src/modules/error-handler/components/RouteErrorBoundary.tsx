import { ObjectMetadataItemNotFoundError } from '@/object-metadata/errors/ObjectMetadataNotFoundError';
import styled from '@emotion/styled';
import { ReactNode } from 'react';
import { useNavigate, useRouteError } from 'react-router-dom';

const StyledRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  align-items: flex-start;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(6)};
  height: 100%;
  background: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledTitle = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.xl};
  font-weight: 600;
`;

const StyledBody = styled.p`
  margin: 0;
  max-width: 520px;
  font-size: ${({ theme }) => theme.font.size.md};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(1, 3)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.secondary};
  color: ${({ theme }) => theme.font.color.primary};
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: 500;

  &:hover {
    background: ${({ theme }) => theme.background.tertiary};
    border-color: ${({ theme }) => theme.border.color.strong};
  }
`;

const StyledSecondaryText = styled.span`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const getContentForError = (
  error: unknown,
): { title: string; body: ReactNode } => {
  if (error instanceof ObjectMetadataItemNotFoundError) {
    return {
      title: 'Workspace configuration issue',
      body: (
        <>
          <StyledBody>
            One of the data models required for this page (for example the
            <strong> job</strong> object) is missing from your workspace
            configuration.
          </StyledBody>
          <StyledBody>
            You can continue using other parts of the app, but this page needs
            that object to be available. If the problem persists, update your
            workspace objects or contact support.
          </StyledBody>
        </>
      ),
    };
  }

  return {
    title: 'Something went wrong on this page',
    body: (
      <StyledBody>
        The page failed to load. You can try going back home or reloading the
        page. If this keeps happening, please contact support.
      </StyledBody>
    ),
  };
};

export const RouteErrorBoundary = () => {
  const error = useRouteError();
  const navigate = useNavigate();

  const { title, body } = getContentForError(error);

  return (
    <StyledRoot>
      <StyledTitle>{title}</StyledTitle>
      {body}
      <StyledActions>
        <StyledButton type="button" onClick={() => navigate('/')}>
          Go to home
        </StyledButton>
        <StyledButton
          type="button"
          onClick={() => {
            // Hard reload just this tab
            window.location.reload();
          }}
        >
          Reload page
        </StyledButton>
      </StyledActions>
      <StyledSecondaryText>
        Technical details are logged for the team so we can improve this
        experience.
      </StyledSecondaryText>
    </StyledRoot>
  );
};

