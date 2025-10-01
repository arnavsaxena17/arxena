import styled from '@emotion/styled';
import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from 'twenty-ui';

const StyledErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 24px;
  text-align: center;
`;

const StyledErrorTitle = styled.h2`
  color: ${({ theme }) => theme.font.color.danger};
  margin-bottom: 16px;
`;

const StyledErrorMessage = styled.p`
  color: ${({ theme }) => theme.font.color.secondary};
  margin-bottom: 24px;
  max-width: 600px;
`;

const StyledButtonContainer = styled.div`
  display: flex;
  gap: 12px;
`;

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ObjectMetadataErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if this is an ObjectMetadataItemNotFoundError
    if (error.message.includes('Object metadata item') && error.message.includes('cannot be found')) {
      return { hasError: true, error };
    }
    return { hasError: false };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ObjectMetadataErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <StyledErrorContainer>
          <StyledErrorTitle>Object Configuration Error</StyledErrorTitle>
          <StyledErrorMessage>
            The application is missing required object metadata. This usually happens when the workspace 
            setup is incomplete. Please contact support to set up the required objects.
          </StyledErrorMessage>
          <StyledButtonContainer>
            <Button
              variant="primary"
              size="small"
              onClick={this.handleRetry}
            >
              Try Again
            </Button>
            <Button
              variant="secondary"
              size="small"
              onClick={this.handleGoHome}
            >
              Go Home
            </Button>
          </StyledButtonContainer>
        </StyledErrorContainer>
      );
    }

    return this.props.children;
  }
}
