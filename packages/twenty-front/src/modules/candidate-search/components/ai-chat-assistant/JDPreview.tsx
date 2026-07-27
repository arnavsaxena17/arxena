import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledJDPreview = styled.div`
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  padding: ${themeCssVariables.spacing[3]};
  margin: ${themeCssVariables.spacing[2]} 0;
`;

const StyledJDTitle = styled.h3`
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  color: ${themeCssVariables.font.color.primary};
  margin: 0 0 ${themeCssVariables.spacing[2]} 0;
`;

const StyledJDDetails = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${themeCssVariables.spacing[2]};
  margin-bottom: ${themeCssVariables.spacing[2]};
`;

const StyledJDDetail = styled.div`
  strong {
    color: ${themeCssVariables.font.color.primary};
    font-weight: ${themeCssVariables.font.weight.semiBold};
  }

  span {
    color: ${themeCssVariables.font.color.secondary};
  }
`;

const StyledChip = styled.span<{ clickable?: boolean }>`
  display: inline-block;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  background-color: ${themeCssVariables.color.blue10};
  color: ${themeCssVariables.color.blue};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
  margin: ${themeCssVariables.spacing[1]};
  cursor: ${({ clickable }) => (clickable ? 'pointer' : 'default')};

  &:hover {
    background-color: ${({ clickable }) =>
      clickable
        ? themeCssVariables.color.blue2
        : themeCssVariables.color.blue10};
  }
`;

interface ParsedJobDescription {
  jobTitle: string;
  company: string;
  location: string;
  experienceLevel: string;
  keywords?: string[];
}

type JDPreviewProps = {
  parsedJobDescription: ParsedJobDescription | null;
};

export const JDPreview = ({ parsedJobDescription }: JDPreviewProps) => {
  if (!parsedJobDescription) return null;

  const jd = parsedJobDescription;

  return (
    <StyledJDPreview>
      <StyledJDTitle>Project Description Preview</StyledJDTitle>
      <StyledJDDetails>
        <StyledJDDetail>
          <strong>Title:</strong> <span>{jd.jobTitle}</span>
        </StyledJDDetail>
        <StyledJDDetail>
          <strong>Company:</strong> <span>{jd.company}</span>
        </StyledJDDetail>
        <StyledJDDetail>
          <strong>Location:</strong> <span>{jd.location}</span>
        </StyledJDDetail>
        <StyledJDDetail>
          <strong>Experience:</strong> <span>{jd.experienceLevel}</span>
        </StyledJDDetail>
      </StyledJDDetails>
      {jd.keywords && jd.keywords.length > 0 && (
        <div>
          <strong>Keywords:</strong>
          <div>
            {jd.keywords.map((keyword: string, index: number) => (
              <StyledChip key={index} clickable>
                {keyword}
              </StyledChip>
            ))}
          </div>
        </div>
      )}
    </StyledJDPreview>
  );
};
