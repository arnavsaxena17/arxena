import { currentUserState } from '@/auth/states/currentUserState';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { currentUnreadChatMessagesState } from '@/baileys/states/currentUnreadMessagesState';
import styled from '@emotion/styled';
import React, { useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { Jobs, UnreadMessageListManyCandidates } from 'twenty-shared';
import ChatWindow from './ChatWindow';


interface ChatMainProps {
  initialCandidateId?: string;
}

const ChatContainer = styled.div`
  display: flex;
  height: 100vh;
  width: 100%;
  position: relative;
  margin-left: 8px;
  margin-right: 8px;
  overflow: hidden;

  @media (max-width: 768px) {
    flex-direction: column; // Stack components vertically on mobile
    margin: 0;
    height: 100vh;
  }
`;


const SidebarContainer = styled.div<{ width: number }>`
  overflow-x: auto;
  display: flex;
  height: 100vh;
  width: ${props => props.width}px;
  min-width: 200px;
  max-width: 800px;
  flex-shrink: 0;

  @media (max-width: 768px) {
    width: 100%;
    height: 40vh;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 10;
  }
`;



const ChatWindowContainer = styled.div<{ sidebarWidth: number }>`
  position: relative;
  flex-grow: 1;
  min-width: 0;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  @media (max-width: 768px) {
    height: 60vh;
    width: 100%;
    margin-top: 0vh; // Adjust based on sidebar height
  }
`;


const SpinnerContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  width: 100%;
`;

const Spinner = styled.div`
  width: 40px;
  height: 40px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid ${({ theme }) => theme.color.blue};
  border-radius: 50%;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const Resizer = styled.div`
  // width: 4px;
  cursor: col-resize;
  background-color: #e0e0e0;
  height: 100vh;
  position: relative;
  transition: background-color 0.2s;
  z-index: 10;

  &:hover {
    background-color: #bdbdbd;
  }

  &:active {
    background-color: #9e9e9e;
  }
`;



const LoadingStates = {
  INITIAL: 'initial',
  LOADING_CACHE: 'loading_cache',
  LOADING_API: 'loading_api',
  READY: 'ready',
  ERROR: 'error'
};


// export interface recruiterProfileType {
//   job_title: any;
//   job_company_name: any;
//   company_description_oneliner: any;
//   first_name: any;
//   last_name: any;
//   status: string;
//   name: string;
//   email: string;
//   phone: string;
//   input: string; // Add the 'input' property
// }


export default function ChatMain({ initialCandidateId }: ChatMainProps) {
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
    const currentUser = useRecoilValue(currentUserState);
    // const userEmail = currentUser?.email;






  

  console.log("This is the currentWorkspaceMember:", currentWorkspaceMember);
  console.log("This is the currentWorkspace:", currentWorkspace);
  console.log("This is the currentUser:", currentUser);


  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [individuals, setIndividuals] = useState([]);

  const [loadingState, setLoadingState] = useState(LoadingStates.INITIAL);

  const [selectedIndividual, setSelectedIndividual] = useState<string>('');
  const [isLoading, setIsLoading] = useState(individuals.length === 0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Jobs[]>([]);

  const [unreadMessages, setUnreadMessages] = useState<UnreadMessageListManyCandidates>({
    listOfUnreadMessages: [],
  });

  // Recoil states
  const [tokenPair] = useRecoilState(tokenPairState);
  const [currentUnreadMessages, setCurrentUnreadMessages] = useRecoilState(currentUnreadChatMessagesState);

  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);


  console.log("is refreshing :", isRefreshing)
  const startResizing = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };
  console.log("This is the loading state :", loadingState)



    return (
    <ChatContainer>
      {!isMobile && <Resizer onMouseDown={startResizing} />}
      <ChatWindowContainer sidebarWidth={sidebarWidth}>
        <ChatWindow />
      </ChatWindowContainer>
    </ChatContainer>
  );
}