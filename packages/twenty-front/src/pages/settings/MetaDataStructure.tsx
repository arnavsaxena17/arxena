import { tokenPairState } from '@/auth/states/tokenPairState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import styled from '@emotion/styled';
import { useState } from 'react';
import { useRecoilState } from 'recoil';

const StyledButtonContainer = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 16px;
`;

const StyledButton = styled.button<{
  variant?: 'primary' | 'secondary';
  submitted?: boolean;
}>`
  background-color: ${({ variant, submitted }) =>
    submitted ? 'white' : variant === 'secondary' ? 'white' : 'blue'};
  color: ${({ variant, submitted }) =>
    submitted ? 'white' : variant === 'secondary' ? 'black' : 'white'};
  padding: 8px 16px;
  border-radius: 4px;
  border: 1px solid
    ${({ variant, submitted }) =>
      submitted ? 'white' : variant === 'secondary' ? 'white' : 'blue'};
  cursor: ${({ submitted }) => (submitted ? 'not-allowed' : 'pointer')};

  &:hover {
    background-color: ${({ variant, submitted }) =>
      submitted ? 'white' : variant === 'secondary' ? 'white' : 'blue'};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const MetadataStructureSection = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tokenPair] = useRecoilState(tokenPairState);

  // Replace the simple useState with one that initializes from localStorage
  const [hasBeenClicked, setHasBeenClicked] = useState(() => {
    // Check localStorage for the saved state on component mount
    return localStorage.getItem('metadataStructureCreated') === 'true';
  });

  const { enqueueSnackBar } = useSnackBar();

  const handleCreateStructure = async () => {
    if (isSubmitting || hasBeenClicked) return;
    setIsSubmitting(true);
    setHasBeenClicked(true);

    // Save to localStorage when the button is clicked
    localStorage.setItem('metadataStructureCreated', 'true');

    try {
      const response = await fetch(
        `${process.env.REACT_APP_SERVER_BASE_URL}/workspace-modifications/create-metadata-structure`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` },
        },
      );

      if (!response.ok) {
        throw new Error('Failed to create metadata structure');
      }

      enqueueSnackBar('Metadata structure created successfully', {
        variant: SnackBarVariant.Success,
      });
    } catch (error) {
      enqueueSnackBar(
        error instanceof Error
          ? `Failed to create metadata structure: ${error.message}`
          : 'Failed to create metadata structure',
        {
          variant: SnackBarVariant.Error,
        },
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <StyledButtonContainer>
      <StyledButton
        onClick={handleCreateStructure}
        disabled={isSubmitting}
        submitted={hasBeenClicked && !isSubmitting}
      >
        {isSubmitting
          ? 'Creating...'
          : hasBeenClicked
            ? 'Creating Structure..'
            : 'Create Metadata Structure'}
      </StyledButton>
    </StyledButtonContainer>
  );
};
