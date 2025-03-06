import { tokenPairState } from '@/auth/states/tokenPairState';
import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import React, { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { InterviewDataJobTemplate, queryByvideoInterview, VideoInterviewResponseViewerProps } from 'twenty-shared';
import VideoDownloaderPlayer from './VideoDownloaderPlayer';

const StyledContainer = styled.div<{ theme: any }>`
  background-color: white;
  width: 100%;
  padding: 20px;
  height: 100vh; // Set a specific height
  overflow-y: auto; // Enable vertical scrolling
`;


const TranscriptContainer = styled.div`
  background-color: #f5f5f5;
  padding: 15px;
  border-radius: 4px;
  margin-top: 10px;
  margin-bottom: 20px;
`;

const TranscriptHeading = styled.h4`
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
`;

const TranscriptText = styled.p`
  font-size: 14px;
  line-height: 1.5;
  color: #444;
  white-space: pre-wrap;
`;


const CompanyInfo = styled.div`
  margin-bottom: 20px;
`;

const QuestionContainer = styled.div`
  margin-bottom: 30px;
`;

const QuestionText = styled.h3`
  margin-bottom: 15px;
`;

const VideoContainer = styled.div`
  background-color: black;
  width: 100%;
  max-width: 800px;
  margin: 10px 0;
`;



const VideoInterviewResponseViewer: React.FC<VideoInterviewResponseViewerProps> = ({ videoInterviewId }) => {
  const [interviewData, setInterviewData] = useState<InterviewDataJobTemplate | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();
  const [tokenPair] = useRecoilState(tokenPairState);
  // Clean up IDs from paths
  const cleanId = (id: string) => (id.includes('/') ? id.split('/').pop() : id);

  const fetchInterviewData = async () => {
    try {
      // Try videoInterviewStatusId first
      if (videoInterviewId) {
        const response = await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}/graphql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
          },
          body: JSON.stringify({
            query: queryByvideoInterview,
            variables: {
              objectRecordId: cleanId(videoInterviewId),
            },
          }),
        });

        const responseData = await response.json();
        console.log('REsoinse::', responseData);

        // If we got valid data, transform and use it
        if (responseData?.data?.videoInterview?.candidate) {
          console.log("We got valid data in videoInterviewStatus");
          const transformedData = transformvideoInterviewStatusData(responseData);
          console.log("transformedData::", transformedData);
          setInterviewData(transformedData);
          setLoading(false);
          return;
        }
      }


      throw new Error('No valid data found with provided IDs');
    } catch (err) {
      console.error('Full error:', err);
      setError(`Error fetching interview data: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  // Separate transformation functions for cleaner code
  const transformvideoInterviewStatusData = (responseData: any): InterviewDataJobTemplate => {
    console.log("Going to try and transform the data::", responseData);
    const videoInterview = responseData.data.videoInterview;
    const candidate = videoInterview.candidate;
    const responses = videoInterview.videoInterviewResponse.edges || [];
    console.log("videoInterview.videoInterviewQuestions:videoInterview.videoInterviewQuestions", videoInterview.videoInterviewTemplate.videoInterviewQuestions);
    const transformedData: InterviewDataJobTemplate =  {
      job: {
        id: candidate.jobs.id,
        company: {
          name: candidate?.jobs?.company?.name,
        },
        name: candidate?.jobs?.name,
      },
      videoInterviewTemplate: {
        videoInterviewQuestions: {
          edges: videoInterview.videoInterviewTemplate.videoInterviewQuestions.edges.map((questionEdge: { node: any }) => {
            const questionResponses = responses.filter(
              (responseEdge: { node: any }) => 
                responseEdge.node.videoInterviewQuestionId === questionEdge.node.id
            );
            return {
              node: {
                id: questionEdge.node.id,
                questionValue: questionEdge.node.questionValue,
                timeLimit: questionEdge.node.timeLimit,
                videoInterviewResponses: {
                  edges: questionResponses.map((responseEdge: { node: any }) => ({
                    node: {
                      id: responseEdge.node.id,
                      transcript: responseEdge.node.transcript,
                      videoInterviewQuestionId: responseEdge.node.videoInterviewQuestionId,
                      attachments: responseEdge.node.attachments,
                    },
                  })),
                },
              },
            };
          }),
        },
      },
    };
    return transformedData;
  }
  

 


  useEffect(() => {
    if ( !videoInterviewId) {
      setError('VideoInterview id must be provided');
      setLoading(false);
      return;
    }
    fetchInterviewData();
  }, [videoInterviewId, tokenPair?.accessToken?.token]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!interviewData) return <div>No interview data found</div>;

  console.log("interviewData.videoInterview.videoInterviewQuestionsinterviewData.videoInterview.videoInterviewQuestionsdata::", interviewData);
  console.log("interviewData.videoInterview.videoInterviewQuestionsinterviewData.videoInterview::", interviewData?.videoInterviewTemplate?.videoInterviewQuestions);


  if (interviewData.videoInterviewTemplate.videoInterviewQuestions.edges.length === 0) {
    console.log('No video interview questions available');
  } else {
    console.log('Video interview questions available');
    interviewData.videoInterviewTemplate.videoInterviewQuestions.edges.forEach(({ node: question }) => {
      const matchingResponses = question.videoInterviewResponses.edges.filter(
        ({ node: response }) => response.videoInterviewQuestionId === question.id
      );
      console.log("matchingResponses::", matchingResponses);
      console.log(`Question: ${question.questionValue}`);
      if (matchingResponses.length === 0) {
        console.log(`No responses available for question ID: ${question.id}`);
      } else {
        console.log(`Responses available for question ID: ${question.id}`);
        console.log(`Responses matching for question ID: matchingResponses`, matchingResponses);
        matchingResponses.forEach(({ node: response }) => {
          console.log("response::", response);
          console.log("response::", response?.attachments?.edges);
          console.log("response::", response?.attachments);
          console.log(`Response ID: ${response.id}`);
            const videoAttachment = response?.attachments?.edges.find(
              edge => edge?.node?.type === 'Video' || 
              ['mp4', 'webm', 'avi'].some(ext => edge?.node?.fullPath.endsWith(ext))
            );

            // Clean up duplicate tokens if found
            if (videoAttachment?.node?.fullPath) {
              const url = new URL(videoAttachment.node.fullPath);
              const firstToken = url.searchParams.get('token');
              url.search = firstToken ? `?token=${firstToken}` : '';
              videoAttachment.node.fullPath = url.toString();
              console.log("videoAttachment.node.fullPath::", videoAttachment.node.fullPath);
            }

            console.log("videoAttachment::", videoAttachment);
          if (!videoAttachment) {
            console.log(`No video available for response ID: ${response.id}`);
          }
        });
      }
    });
  }


  const cleanVideoAttachmentPath = (videoAttachment: { node: { fullPath: string } }) => {
    if (!videoAttachment?.node?.fullPath) return '';
    
    try {
      let urlStr = videoAttachment.node.fullPath;
      // Remove any additional "?token=" parameters after the first one
      const firstTokenIndex = urlStr.indexOf('?token=');
      if (firstTokenIndex !== -1) {
        urlStr = urlStr.substring(0, urlStr.indexOf('?', firstTokenIndex + 1));
      }
      console.log('Cleaned video attachment path:', urlStr);
      return urlStr;
    } catch (error) {
      console.error('Error cleaning video attachment path:', error);
      return videoAttachment.node.fullPath;
    }
  };

  return (
    <StyledContainer theme={theme}>
      <CompanyInfo>
        <h2>{interviewData.job?.company?.name}</h2>
        <h3>{interviewData.job?.name}</h3>
      </CompanyInfo>

      {interviewData.videoInterviewTemplate.videoInterviewQuestions.edges.map(({ node: question }, index) => {
        // Find responses that match this specific question ID
        const matchingResponses = question.videoInterviewResponses.edges.filter(
          ({ node: response }) => response.videoInterviewQuestionId === question.id
        );
        return (
          <QuestionContainer key={question.id}>
            <QuestionText>
              Question {index + 1}: {question.questionValue}
            </QuestionText>
      
            {matchingResponses.map(({ node: response }) => {
                const videoAttachment = response.attachments.edges.find(
                edge => edge.node.type === 'Video' || 
                ['mp4', 'webm', 'avi'].some(ext => edge.node.fullPath.endsWith(ext))
                );
                const videoUrl = videoAttachment ? cleanVideoAttachmentPath(videoAttachment) : '';
                console.log("videoUrl::", videoUrl);
              return videoAttachment ? (
                <VideoContainer key={response.id}>
                  <VideoDownloaderPlayer 
                    // videoUrl={`${process.env.REACT_APP_SERVER_BASE_URL}/files/${videoAttachment.node.fullPath}`} 
                    videoUrl={`${videoUrl}`} 
                  />
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
        );
      })}
    </StyledContainer>
  );
}
  
  
  export default VideoInterviewResponseViewer
