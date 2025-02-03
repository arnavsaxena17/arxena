import { useQuery } from '@apollo/client';
import styled from '@emotion/styled';
import { useRecoilState, useResetRecoilState } from 'recoil';

import { VideoInterviewLeftSideContainer } from '@/video-interview/interview-creation/left-side/components/VideoInterviewLeftSideContainer';
import { VideoInterviewRightSideContainer } from '@/video-interview/interview-creation/right-side/components/VideoInterviewRightSideContainer';
import { isVideoInterviewModalOpenState } from '@/video-interview/interview-creation/states/videoInterviewModalState';
import { questionsArrState } from '@/video-interview/interview-creation/states/questionsArrState';
import { questionToDisplayState } from '@/video-interview/interview-creation/states/questionToDisplay';
const StyledModalContainer = styled.div`
  background-color: transparent;
  top: 0px;
  left: 0px;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  position: fixed;
  height: 100vh;
  width: 100vw;
  z-index: 1000;
`;

const StyledAdjuster = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  padding: 0 120px;
  justify-content: center;
  align-items: center;
`;

const StyledModal = styled.div`
  background-color: ${({ theme }) => theme.background.tertiary};
  box-shadow: ${({ theme }) => theme.boxShadow.superHeavy};
  border-radius: 16px;
  display: flex;
  flex-direction: row;
  height: 100%;
  flex-basis: 900px;
  z-index: 1001;
  overflow: hidden;
  max-height: 680px;
  box-sizing: border-box;
`;

export const InterviewCreationModal = ({
  objectNameSingular,
  objectRecordId,
}: {
  objectNameSingular: string;
  objectRecordId: string;
}) => {
  const [isVideoInterviewModalOpen, setIsVideoInterviewModalOpen] = useRecoilState(
    isVideoInterviewModalOpenState,
  );

  const resetQuestionsArr = useResetRecoilState(questionsArrState);
  const resetQuestionToDisplay = useResetRecoilState(questionToDisplayState);
  const closeModal = () => {
    resetQuestionsArr();
    resetQuestionToDisplay();
    setIsVideoInterviewModalOpen(false);
  };

  // const { loading, error, data } = useQuery(FIND_MANY_VIDEO_INTERVIEW_MODELS);
  // console.log("These are the video interview models:", data);

  // if (loading) {
  //   return (
  //     <StyledModalContainer onClick={closeModal}>
  //       <StyledAdjuster>
  //         <StyledModal onClick={(e) => e.stopPropagation()}>
  //           <div>Loading...</div>
  //         </StyledModal>
  //       </StyledAdjuster>
  //     </StyledModalContainer>
  //   );
  // }

  // if (error != null) {
  //   return <div>Error: {error.message}</div>;
  // }



  const data = {
    "data": {
        "videoInterviewModels": {
            "__typename": "VideoInterviewModelConnection",
            "edges": [
                {
                    "node": {
                        "__typename": "VideoInterviewModel",
                        "language": "ENGLISH_UNITED_KINGDOM",
                        "createdAt": "2025-02-01T05:11:53.931Z",
                        "id": "090538fb-535d-4a7c-9e47-35b11c46d443",
                        "country": "US",
                        "updatedAt": "2025-02-01T05:11:53.931Z",
                        "name": "Richard",
                        "position": -6
                    }
                },
                {
                    "node": {
                        "__typename": "VideoInterviewModel",
                        "language": "ENGLISH_UNITED_STATES",
                        "createdAt": "2025-01-31T13:56:01.551Z",
                        "id": "0adafe4a-9979-4ee5-810a-8d81166ba093",
                        "country": "US",
                        "updatedAt": "2025-01-31T13:56:01.551Z",
                        "name": "John",
                        "position": 1
                    }
                },
                {
                    "node": {
                        "__typename": "VideoInterviewModel",
                        "language": "ENGLISH_UNITED_STATES",
                        "createdAt": "2025-02-01T05:11:53.976Z",
                        "id": "196285aa-666d-4e44-9da5-254a60171953",
                        "country": "IN",
                        "updatedAt": "2025-02-01T05:11:53.976Z",
                        "name": "Aditya",
                        "position": -8
                    }
                },
                {
                    "node": {
                        "__typename": "VideoInterviewModel",
                        "language": "ENGLISH_UNITED_KINGDOM",
                        "createdAt": "2025-01-31T13:56:01.716Z",
                        "id": "2764b56d-ea44-4eda-8e8e-7ab1a46ca571",
                        "country": "US",
                        "updatedAt": "2025-01-31T13:56:01.716Z",
                        "name": "Sarah",
                        "position": -1
                    }
                },
                {
                    "node": {
                        "__typename": "VideoInterviewModel",
                        "language": "HINDI",
                        "createdAt": "2025-02-01T05:11:54.002Z",
                        "id": "30c93b4b-58a5-4871-90ce-02ee1a9735f8",
                        "country": "IN",
                        "updatedAt": "2025-02-01T05:11:54.002Z",
                        "name": "Arnav",
                        "position": -9
                    }
                },
                {
                    "node": {
                        "__typename": "VideoInterviewModel",
                        "language": "HINDI",
                        "createdAt": "2025-01-31T13:56:01.736Z",
                        "id": "3e9820aa-07dc-427e-ab09-50048da5d93a",
                        "country": "IN",
                        "updatedAt": "2025-01-31T13:56:01.736Z",
                        "name": "Arnav",
                        "position": -3
                    }
                },
                {
                    "node": {
                        "__typename": "VideoInterviewModel",
                        "language": "ENGLISH_UNITED_KINGDOM",
                        "createdAt": "2025-02-01T05:11:54.035Z",
                        "id": "62e93013-4342-4120-bc3d-4de9c9b05cca",
                        "country": "IN",
                        "updatedAt": "2025-02-01T05:11:54.035Z",
                        "name": "Daksh",
                        "position": -10
                    }
                },
                {
                    "node": {
                        "__typename": "VideoInterviewModel",
                        "language": "ENGLISH_UNITED_KINGDOM",
                        "createdAt": "2025-01-31T13:56:01.703Z",
                        "id": "636979d9-237d-4eec-81e8-d497e53c976a",
                        "country": "US",
                        "updatedAt": "2025-01-31T13:56:01.703Z",
                        "name": "Richard",
                        "position": 0
                    }
                },
                {
                    "node": {
                        "__typename": "VideoInterviewModel",
                        "language": "ENGLISH_UNITED_STATES",
                        "createdAt": "2025-02-01T05:11:53.947Z",
                        "id": "6537f023-2aa9-4b8a-af5b-0ff9a6692e14",
                        "country": "US",
                        "updatedAt": "2025-02-01T05:11:53.947Z",
                        "name": "Sarah",
                        "position": -7
                    }
                },
                {
                    "node": {
                        "__typename": "VideoInterviewModel",
                        "language": "ENGLISH_UNITED_KINGDOM",
                        "createdAt": "2025-01-31T13:56:01.726Z",
                        "id": "a4722fe3-cb27-491e-a858-1142ea378d0b",
                        "country": "IN",
                        "updatedAt": "2025-01-31T13:56:01.726Z",
                        "name": "Aditya",
                        "position": -2
                    }
                },
                {
                    "node": {
                        "__typename": "VideoInterviewModel",
                        "language": "ENGLISH_UNITED_STATES",
                        "createdAt": "2025-02-01T05:11:53.908Z",
                        "id": "c2450beb-acbf-48f8-af58-4bf4391cceed",
                        "country": "US",
                        "updatedAt": "2025-02-01T05:11:53.908Z",
                        "name": "John",
                        "position": -5
                    }
                },
                {
                    "node": {
                        "__typename": "VideoInterviewModel",
                        "language": "ENGLISH_UNITED_KINGDOM",
                        "createdAt": "2025-01-31T13:56:01.748Z",
                        "id": "ca01d8ee-1337-42e6-a37d-1a4b12a4b2ea",
                        "country": "IN",
                        "updatedAt": "2025-01-31T13:56:01.748Z",
                        "name": "Daksh",
                        "position": -4
                    }
                }
            ]
        }
    }
}
  const videoInterviewModelsArr: any = data.data.videoInterviewModels.edges;
  console.log("These are the video interview models:", videoInterviewModelsArr);

  if (!isVideoInterviewModalOpen) {
    return null;
  }

  return (
    <StyledModalContainer onClick={closeModal}>
      <StyledAdjuster>
        <StyledModal onClick={(e) => e.stopPropagation()}>
          <VideoInterviewLeftSideContainer />
          <VideoInterviewRightSideContainer
            videoInterviewModelsArr={videoInterviewModelsArr}
            closeModal={closeModal}
            objectNameSingular={objectNameSingular}
            objectRecordId={objectRecordId}
          />
        </StyledModal>
      </StyledAdjuster>
    </StyledModalContainer>
  );
};
