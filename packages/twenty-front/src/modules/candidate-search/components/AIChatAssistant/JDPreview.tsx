import styled from '@emotion/styled';

const StyledJDPreview = styled.div`
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => theme.spacing(3)};
  margin: ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledJDTitle = styled.h3`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0 0 ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledJDDetails = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

const StyledJDDetail = styled.div`
  strong {
    color: ${({ theme }) => theme.font.color.primary};
    font-weight: ${({ theme }) => theme.font.weight.semiBold};
  }
  
  span {
    color: ${({ theme }) => theme.font.color.secondary};
  }
`;

const StyledChip = styled.span<{ clickable?: boolean }>`
  display: inline-block;
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.color.blue10};
  color: ${({ theme }) => theme.color.blue};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  margin: ${({ theme }) => theme.spacing(1)};
  ${({ clickable }) => clickable && 'cursor: pointer;'}
  
  ${({ clickable, theme }) => clickable && `
    &:hover {
      background-color: ${theme.color.blue20};
    }
  `}
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
      <StyledJDTitle>Job Description Preview</StyledJDTitle>
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
