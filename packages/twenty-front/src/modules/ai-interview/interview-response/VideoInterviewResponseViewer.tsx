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
interface Response {
  id: string;
  transcript: string;
  aIInterviewQuestionId: string;
  attachments: {
    edges: {
      node: {
        type: string;
        fullPath: string;
        name: string;
      };
    }[];
  };
}

interface CandidateData {
  edges: {
    node: {
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
        companies: {
          name: string;
        };
        questions: {
          edges: {
            node: {
              id: string;
              questionValue: string;
              timeLimit: number;
            };
          }[];
        };
      };
      responses: {
        edges: {
          node: Response;
        }[];
      };
    };
  }[];
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
            companies {
              name
            }
            aIInterviews {
              edges {
                node {
                  id
                  name
                  aIInterviewQuestions {
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
          responses {
            edges {
              node {
                id
                transcript
                aIInterviewQuestionId
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

interface Question {
  id: string;
  questionValue: string;
  responses: {
    edges: {
      node: Response;
    }[];
  };
}



interface InterviewData {
  job: {
    companies: {
      name: string;
    };
    name: string;
  };
  aIInterview: {
    aIInterviewQuestions: {
      edges: {
        node: Question;
      }[];
    };
  };
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


const VideoInterviewResponseViewer: React.FC<{ candidateId: string }> = ({ candidateId }) => {
  const [interviewData, setInterviewData] = useState<InterviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();
  const [tokenPair] = useRecoilState(tokenPairState);

  const cleanCandidateId = candidateId.includes('/') 
  ? candidateId.split('/').pop() 
  : candidateId;


  useEffect(() => {
    const fetchInterviewData = async () => {
      try {
        const response = await fetch('http://localhost:3000/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenPair?.accessToken?.token}`,
          },
          body: JSON.stringify({
            query,
            variables: { 
              filter: {
                id: { eq: candidateId.replace("/video-interview-review/","") }
              }
            },
          }),
        });
        
        const responseData = await response.json();
        console.log('GraphQL Response:', responseData); // Debug log

        // Check if the response has the expected structure
        if (!responseData?.data?.candidates) {
          throw new Error('Invalid response structure');
        }

        const candidates = responseData.data.candidates;
        
        // Check if we have any candidates
        if (!candidates.edges || candidates.edges.length === 0) {
          throw new Error('No candidate found');
        }

        const candidate = candidates.edges[0].node;
        
        // Check if candidate has all required data
        if (!candidate.jobs?.aIInterviews?.edges?.[0]?.node?.aIInterviewQuestions?.edges) {
          throw new Error('Incomplete candidate data');
        }

        const transformedData: InterviewData = {
          job: {
            companies: candidate.jobs.companies,
            name: candidate.jobs.name
          },
          aIInterview: {
            aIInterviewQuestions: {
              edges: candidate.jobs.aIInterviews.edges[0].node.aIInterviewQuestions.edges.map(
                (question: any) => ({
                  node: {
                    ...question.node,
                    responses: {
                      edges: (candidate.responses?.edges || []).filter(
                        (response: any) => response.node.aIInterviewQuestionId === question.node.id
                      )
                    }
                  }
                })
              )
            }
          }
        };

        console.log('Transformed Data:', transformedData); // Debug log
        setInterviewData(transformedData);
      } catch (err) {
        console.error('Full error:', err); // Debug log
        setError(`Error fetching interview data: ${(err as Error).message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchInterviewData();
  }, [candidateId, tokenPair?.accessToken?.token]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!interviewData) return <div>No interview data found</div>;

  return (
    <StyledContainer theme={theme}>
      <CompanyInfo>
        <h2>Interview for {interviewData.job.companies.name}</h2>
        <h3>Position: {interviewData.job.name}</h3>
      </CompanyInfo>

      {interviewData.aIInterview.aIInterviewQuestions.edges.map(({ node: question }, index) => (
        <QuestionContainer key={question.id}>
          <QuestionText>
            Question {index + 1}: {question.questionValue}
          </QuestionText>
          
          {question.responses.edges.map(({ node: response }) => {
            const videoAttachment = response.attachments.edges.find(
              edge => edge.node.type === 'Video'
            );

            return videoAttachment ? (
              <VideoContainer key={response.id}>
                <VideoDownloaderPlayer 
                  videoUrl={`http://localhost:3000/files/${videoAttachment.node.fullPath}`} 
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
      ))}
    </StyledContainer>
  );
};

export default VideoInterviewResponseViewer;
