import VideoDownloaderPlayer from '@/video-interview/interview-response/VideoDownloaderPlayer';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import React from 'react';

const StyledContainer = styled.div`
  background-color: white;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[4]};
`;

const CompanyInfo = styled.div`
  margin-bottom: ${themeCssVariables.spacing[4]};
`;

const QuestionContainer = styled.div`
  margin-bottom: ${themeCssVariables.spacing[6]};
`;

const QuestionText = styled.h3`
  margin-bottom: ${themeCssVariables.spacing[3]};
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: 600;
  color: ${themeCssVariables.font.color.primary};
`;

const VideoContainer = styled.div`
  width: 100%;
  max-width: 100%;
  margin: ${themeCssVariables.spacing[2]} 0;
  border-radius: ${themeCssVariables.border.radius.md};
  overflow: hidden;
`;

const TranscriptContainer = styled.div`
  background-color: ${themeCssVariables.background.tertiary};
  padding: ${themeCssVariables.spacing[3]};
  border-radius: ${themeCssVariables.border.radius.md};
  margin-top: ${themeCssVariables.spacing[2]};
  margin-bottom: ${themeCssVariables.spacing[4]};
`;

const TranscriptHeading = styled.h4`
  font-size: ${themeCssVariables.font.size.md};
  font-weight: 600;
  margin-bottom: ${themeCssVariables.spacing[2]};
  color: ${themeCssVariables.font.color.primary};
`;

const TranscriptText = styled.p`
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.5;
  color: ${themeCssVariables.font.color.secondary};
  white-space: pre-wrap;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: ${themeCssVariables.font.color.light};
  text-align: center;
  padding: ${themeCssVariables.spacing[4]};
`;

type VideoInterviewTabProps = {
  candidateData: any;
  isLoading: boolean;
};

// Define types for the video interview data structure
type VideoAttachment = {
  node: {
    id: string;
    type: string;
    fullPath: string;
    name: string;
  };
};

type VideoResponse = {
  id: string;
  transcript: string | null;
  videoInterviewQuestionId: string;
  attachments: {
    edges: VideoAttachment[];
  };
};

type VideoQuestion = {
  id: string;
  questionValue: string;
  timeLimit: number;
};

type QuestionWithResponses = {
  question: VideoQuestion;
  responses: VideoResponse[];
};

const cleanVideoAttachmentPath = (videoAttachment: { node: { fullPath: string } }) => {
  if (!videoAttachment?.node?.fullPath) return '';
  
  try {
    let urlStr = videoAttachment.node.fullPath;
    // Remove any additional "?token=" parameters after the first one
    const firstTokenIndex = urlStr.indexOf('?token=');
    if (firstTokenIndex !== -1) {
      urlStr = urlStr.substring(0, urlStr.indexOf('?', firstTokenIndex + 1));
    }
    return urlStr;
  } catch (error) {
    console.error('Error cleaning video attachment path:', error);
    return videoAttachment.node.fullPath;
  }
};

const VideoInterviewTab: React.FC<VideoInterviewTabProps> = ({
  candidateData,
  isLoading,
}) => {
  if (isLoading) {
    return <EmptyState>Loading video interview data...</EmptyState>;
  }
  
  if (!candidateData) {
    return <EmptyState>No candidate data available</EmptyState>;
  }
  
  const videoInterviewResponses = candidateData.videoInterviewResponse?.edges || [];
  const videoInterview = candidateData.videoInterview?.edges?.[0]?.node;
  const videoInterviewQuestions = videoInterview?.videoInterviewTemplate?.videoInterviewQuestions?.edges || [];
  
  if (videoInterviewResponses.length === 0) {
    return <EmptyState>No video interview responses available for this candidate</EmptyState>;
  }
  
  // Match responses with questions
  const questionsWithResponses = videoInterviewQuestions.map((questionEdge: any) => {
    const question = questionEdge.node;
    const matchingResponses = videoInterviewResponses.filter(
      (responseEdge: any) => responseEdge.node.videoInterviewQuestionId === question.id
    );
    
    return {
      question,
      responses: matchingResponses.map((responseEdge: any) => responseEdge.node),
    };
  });

  // Check if there are any responses at all after filtering
  const hasAnyResponses = questionsWithResponses.some(
    (item: QuestionWithResponses) => item.responses && item.responses.length > 0
  );

  if (!hasAnyResponses) {
    return <EmptyState>No matching video responses found for this candidate's interview questions</EmptyState>;
  }

  return (
    <StyledContainer>
      <CompanyInfo>
        <h2>{candidateData.projects?.company?.name || 'Company'}</h2>
        <h3>{candidateData.projects?.name || 'Project'}</h3>
      </CompanyInfo>

      {questionsWithResponses.map(({ question, responses }: QuestionWithResponses, index: number) => (
        <QuestionContainer key={question?.id || index}>
          <QuestionText>
            Question {index + 1}: {question?.questionValue || 'Unknown Question'}
          </QuestionText>
          
          {responses.map((response: VideoResponse) => {
            const videoAttachment = response.attachments?.edges?.find(
              (edge: VideoAttachment) => edge.node.type === 'Video' || 
              ['mp4', 'webm', 'avi'].some(ext => edge.node.fullPath.endsWith(ext))
            );
            
            const videoUrl = videoAttachment ? cleanVideoAttachmentPath(videoAttachment) : '';
            
            return videoAttachment ? (
              <VideoContainer key={response.id}>
                <VideoDownloaderPlayer videoUrl={videoUrl} />
                {response.transcript && (
                  <TranscriptContainer>
                    <TranscriptHeading>Transcript</TranscriptHeading>
                    <TranscriptText>{response.transcript}</TranscriptText>
                  </TranscriptContainer>
                )}
              </VideoContainer>
            ) : null;
          })}
        </QuestionContainer>
      ))}
    </StyledContainer>
  );
};

export default VideoInterviewTab; 