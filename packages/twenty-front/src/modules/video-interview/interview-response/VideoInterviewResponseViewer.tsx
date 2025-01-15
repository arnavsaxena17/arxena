import React, { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import VideoDownloaderPlayer from './VideoDownloaderPlayer';
import { useTheme } from '@emotion/react';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useRecoilState } from 'recoil';

const StyledContainer = styled.div<{ theme: any }>`
  background-color: white;
  width: 100%;
  padding: 20px;
  height: 100vh; // Set a specific height
  overflow-y: auto; // Enable vertical scrolling
`;

const StyledVideoContainer = styled.div`
  background-color: black;
  height: 50%;
  width: 50%;
`;

const DebugInfo = styled.div`
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px;
  margin-top: 10px;
  border-radius: 5px;
  font-family: monospace;
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

// Types
interface Name {
  firstName: string;
  lastName: string;
}

interface Person {
  name: Name;
}

interface company {
  name: string;
}

interface Attachment {
  id: string;
  type: string;
  fullPath: string;
  name: string;
}

interface videoInterviewResponse {
  id: string;
  transcript: string | null;
  videoInterviewQuestionId: string;
  attachments: {
    edges: Array<{
      node: Attachment;
    }>;
  };
}

interface videoInterviewQuestion {
  id: string;
  questionValue: string;
  timeLimit: number | null;
  videoInterviewResponses: {
    edges: Array<{
      node: videoInterviewResponse;
    }>;
  };
}

interface Job {
  id: string;
  name: string;
  company: company;
}

interface InterviewData {
  job: Job;
  videoInterview: {
    videoInterviewQuestions: {
      edges: Array<{
        node: videoInterviewQuestion;
      }>;
    };
  };
}

const query = `query FindManyCandidates($filter: CandidateFilterInput) {
    candidates(filter: $filter) {
      edges {
        node {
          id
          people {
            name {
              firstName
              lastName
            }
          }
          jobs {
            id
            name
            company {
              name
            }
            videoInterviews {
              edges {
                node {
                  id
                  name
                  videoInterviewQuestions {
                    edges {
                      node {
                        id
                        questionValue
                        timeLimit
                      }
                    }
                  }
                }
              }
            }
          }
          videoInterviewResponses {
            edges {
              node {
                id
                transcript
                videoInterviewQuestionId
                attachments {
                  edges {
                    node {
                      id
                      type
                      fullPath
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

interface VideoInterviewResponseViewerProps {
  candidateId?: string;
  videoInterviewId?: string;
}

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

const queryByvideoInterviewStatus = `query FindOnevideoInterviewStatus($objectRecordId: ID!) {
  videoInterviewStatus(filter: {id: {eq: $objectRecordId}}) {
    timelineActivities {
      edges {
        node {
          offerId
          screeningId
          videoInterviewStatusId
          linkedRecordCachedName
          jobId
          properties
          clientInterviewId
          videoInterviewQuestionId
          questionId
          candidateReminderId
          answerId
          whatsappMessageId
          name
          id
          promptId
          personId
          opportunityId
          updatedAt
          videoInterviewModelId
          workspaceMemberId
          linkedRecordId
          responseId
          candidateId
          createdAt
          cvSentId
          candidateEnrichmentId
          videoInterviewId
          clientContactId
          shortlistId
          recruiterInterviewId
          linkedObjectMetadataId
          companyId
          happensAt
          whatsappTemplateId
        }
      }
    }
    candidateId
    videoInterview {
      introduction
      createdAt
      id
      jobId
      instructions
      videoInterviewModelId
      name

      videoInterviewQuestions {
        edges {
          node {
            id
            questionValue
            timeLimit
          }
        }
      }
      position
      updatedAt
    }
    videoInterviewId
    position
    interviewLink {
      label
      url
    }
    cameraOn
    interviewReviewLink {
      label
      url
    }
    id
    videoInterviewResponses {
      edges {
        node {
          timeLimitAdherence
          name
          timerStopped
          startedResponding
          updatedAt
          position
          personId
          timer
          id
          attachments {
            edges {
              node {
                id
                type
                fullPath
                name
              }
            }
          }
          createdAt
          feedback
          timerStarted
          completedResponse
          transcript
          candidateId
          jobId
          retakesRemaining
          videoInterviewStatusId
          videoInterviewQuestionId
        }
      }
    }
    interviewStarted
    interviewCompleted
    micOn
    name
    createdAt
    updatedAt
    candidate {
      stopChat
      isVideoInterviewCompleted
      hiringNaukriUrl {
        label
        url
      }
      displayPicture {
        label
        url
      }
      startMeetingSchedulingChat
      uniqueStringKey
      whatsappProvider
      chatCount
      peopleId
      startChat
      status
      jobs {
            id
            name
            company {
              name
        }
      }
      jobSpecificFields
      jobsId
      createdAt
      updatedAt
      lastEngagementChatControl
      startVideoInterviewChat
      resdexNaukriUrl {
        label
        url
      }
      engagementStatus
      id
      position
      name
      candConversationStatus
    }
  }
  }
`;

interface CandidateAPIResponse {
  id: string;
  people: {
    name: {
      firstName: string;
      lastName: string;
    };
  };
  jobs: {
    id: string;
    name: string;
    company: {
      name: string;
    };
    videoInterviews: {
      edges: Array<{
        node: {
          id: string;
          name: string;
          videoInterviewQuestions: {
            edges: Array<{
              node: {
                id: string;
                questionValue: string;
                timeLimit: number | null;
              };
            }>;
          };
        };
      }>;
    };
  };
  videoInterviewResponses: {
    edges: Array<{
      node: {
        id: string;
        transcript: string | null;
        videoInterviewQuestionId: string;
        attachments: {
          edges: Array<{
            node: {
              id: string;
              type: string;
              fullPath: string;
              name: string;
            };
          }>;
        };
      };
    }>;
  };
}

const VideoInterviewResponseViewer: React.FC<VideoInterviewResponseViewerProps> = ({ candidateId, videoInterviewId }) => {
  const [interviewData, setInterviewData] = useState<InterviewData | null>(null);
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
            query: queryByvideoInterviewStatus,
            variables: {
              objectRecordId: cleanId(videoInterviewId),
            },
          }),
        });

        const responseData = await response.json();
        console.log('REsoinse::', responseData);

        // If we got valid data, transform and use it
        if (responseData?.data?.videoInterviewStatus?.candidate) {
          const transformedData = transformvideoInterviewStatusData(responseData);
          setInterviewData(transformedData);
          setLoading(false);
          return;
        }
      }

      if (candidateId) {
        const response = await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}/graphql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
          },
          body: JSON.stringify({
            query,
            variables: {
              filter: {
                id: { eq: cleanId(candidateId) },
              },
            },
          }),
        });

        const responseData = await response.json();
        if (responseData?.data?.candidates?.edges?.[0]?.node) {
          console.log('WE got valid data in candiate data');
          const candidate = responseData.data.candidates.edges[0].node;
          const transformedData = transformCandidateData(candidate);
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
  const transformvideoInterviewStatusData = (responseData: any): InterviewData => {
    const videoInterviewStatus = responseData.data.videoInterviewStatus;
    const candidate = videoInterviewStatus.candidate;
    const responses = videoInterviewStatus.videoInterviewResponses.edges || [];
    const videoInterview = videoInterviewStatus.videoInterview;
    const transformedData: InterviewData =  {
      job: {
        id: candidate.jobs.id,
        company: {
          name: candidate.jobs.company.name,
        },
        name: candidate.jobs.name,
      },
      videoInterview: {
        videoInterviewQuestions: {
          edges: videoInterview.videoInterviewQuestions.edges.map((questionEdge: { node: any }) => {
            // Filter responses for this specific question
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
  

  const transformCandidateData = (candidate: CandidateAPIResponse): InterviewData => {
    const transformedData: InterviewData =   {
        job: {
          id: candidate.jobs.id,
          company: candidate.jobs.company,
          name: candidate.jobs.name,
        },
        videoInterview: {
          videoInterviewQuestions: {
            edges: candidate.jobs.videoInterviews.edges[0].node.videoInterviewQuestions.edges.map(
              ({ node: question }) => {
                // Filter responses for this specific question
                const questionResponses = candidate.videoInterviewResponses.edges.filter(
                  response => response.node.videoInterviewQuestionId === question.id
                );
                return {
                  node: {
                    id: question.id,
                    questionValue: question.questionValue,
                    timeLimit: question.timeLimit,
                    videoInterviewResponses: {
                      edges: questionResponses.map(response => ({
                        node: {
                          id: response.node.id,
                          transcript: response.node.transcript,
                          videoInterviewQuestionId: response.node.videoInterviewQuestionId,
                          attachments: response.node.attachments,
                        },
                      })),
                    },
                  },
                };
              }
            ),
          },
        },
      };
    return transformedData
  };




  useEffect(() => {
    if (!candidateId && !videoInterviewId) {
      setError('Either candidateId or videoInterviewStatusId must be provided');
      setLoading(false);
      return;
    }
    fetchInterviewData();
  }, [candidateId, videoInterviewId, tokenPair?.accessToken?.token]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!interviewData) return <div>No interview data found</div>;



  return (
    <StyledContainer theme={theme}>
      <CompanyInfo>
        <h2>{interviewData.job.company.name}</h2>
        <h3>{interviewData.job.name}</h3>
      </CompanyInfo>

      {interviewData.videoInterview.videoInterviewQuestions.edges.map(({ node: question }, index) => {
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
                edge => edge.node.type === 'Video'
              );
              return videoAttachment ? (
                <VideoContainer key={response.id}>
                  <VideoDownloaderPlayer 
                    videoUrl={`${process.env.REACT_APP_SERVER_BASE_URL}/files/${videoAttachment.node.fullPath}`} 
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
