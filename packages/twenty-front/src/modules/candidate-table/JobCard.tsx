import { gql, useMutation } from '@apollo/client';
import styled from '@emotion/styled';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRecoilState, useSetRecoilState } from 'recoil';
import {
  IconBriefcase,
  IconCalendar,
  IconDotsVertical,
  IconMap,
  IconUser,
  MenuItem
} from 'twenty-ui';

import { jobsState } from '@/candidate-table/states/states';
import { DropdownMenu } from '@/ui/layout/dropdown/components/DropdownMenu';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { useDropdown } from '@/ui/layout/dropdown/hooks/useDropdown';
import { isNavigationDrawerExpandedState } from '@/ui/navigation/states/isNavigationDrawerExpanded';
import { navigationDrawerExpandedMemorizedState } from '@/ui/navigation/states/navigationDrawerExpandedMemorizedState';
import { navigationMemorizedUrlState } from '@/ui/navigation/states/navigationMemorizedUrlState';
import { UpdateOneJob } from 'twenty-shared';


type JobCardProps = {
  id: string;
  name: string;
  createdAt: string;
  isActive: boolean;
  jobLocation?: string;
  candidateCount?: number;
};

const StyledCard = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.md};
  padding: ${({ theme }) => theme.spacing(4)};
  background-color: ${({ theme }) => theme.background.primary};
  transition: all 0.2s ease-in-out;
  height: 150px;
  position: relative;
  cursor: pointer;

  &:hover {
    box-shadow: ${({ theme }) => theme.boxShadow.light};
    border-color: ${({ theme }) => theme.border.color.medium};
  }
`;

const StyledCardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

const StyledCardTitle = styled.h3`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
`;

const StyledCardContent = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledInfoItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledCardFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: ${({ theme }) => theme.spacing(2)};
`;

const StyledActiveStatus = styled.div<{ isActive: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  color: ${({ isActive, theme }) => 
    isActive ? theme.font.color.primary : theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledMenuButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.font.color.tertiary};
  height: 24px;
  width: 24px;
  padding: 0;
  border-radius: ${({ theme }) => theme.border.radius.sm};

  &:hover {
    background-color: ${({ theme }) => theme.background.tertiary};
  }
`;

const StyledDropdownMenu = styled(DropdownMenu)`
  position: absolute;
  top: 32px;
  right: 0;
  z-index: 1;
  background-color: ${({ theme }) => theme.background.primary};
  height: ${({ theme }) => theme.spacing(10)};
  max-height: 100px;
  width: 200px;
`;

export const JobCard = ({ 
  id, 
  name, 
  createdAt, 
  isActive, 
  jobLocation, 
  candidateCount = 0 
}: JobCardProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [jobs, setJobs] = useRecoilState(jobsState);
  const dropdownId = `job-card-dropdown-${id}`;
  const { isDropdownOpen, toggleDropdown, closeDropdown } = useDropdown(dropdownId);
  
  const [isNavigationDrawerExpanded, setIsNavigationDrawerExpanded] =
    useRecoilState(isNavigationDrawerExpandedState);
  const setNavigationDrawerExpandedMemorized = useSetRecoilState(
    navigationDrawerExpandedMemorizedState,
  );
  const setNavigationMemorizedUrl = useSetRecoilState(
    navigationMemorizedUrlState,
  );
  
  const [updateJob] = useMutation(gql(UpdateOneJob));
  
  const formattedDate = new Date(createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const handleCardClick = (event: React.MouseEvent) => {
    // Don't navigate if clicking on the menu button or dropdown
    if ((event.target as HTMLElement).closest('.menu-container')) {
      return;
    }
    
    setNavigationDrawerExpandedMemorized(isNavigationDrawerExpanded);
    setIsNavigationDrawerExpanded(true);
    setNavigationMemorizedUrl(location.pathname + location.search);
    navigate(`/job/${id}`);
  };

  const toggleJobStatus = () => {
    const newStatus = !isActive;
    const updatedJobs = jobs.map(job => 
      job.id === id ? { ...job, isActive: newStatus } : job
    );
    setJobs(updatedJobs);
    updateJob({
      variables: {
        idToUpdate: id,
        input: {
          isActive: newStatus
        }
      },
      onError: (error) => {
        console.error('Failed to update job status:', error);
        setJobs(jobs);
      }
    });
    
    closeDropdown();
  };

  return (
    <StyledCard onClick={handleCardClick}>
      <StyledCardHeader>
        <StyledCardTitle>{name}</StyledCardTitle>
        <div className="menu-container" onClick={(e) => e.stopPropagation()}>
          <StyledMenuButton onClick={toggleDropdown}>
            <IconDotsVertical size={16} />
          </StyledMenuButton>
          {isDropdownOpen && (
            <StyledDropdownMenu width={200}>
              <DropdownMenuItemsContainer>
                <MenuItem 
                  accent={isActive ? 'default' : 'danger'}
                  onClick={toggleJobStatus} 
                  text={isActive ? "Mark as Inactive" : "Mark as Active"} 
                  LeftIcon={isActive ? IconBriefcase : IconBriefcase}
                />
              </DropdownMenuItemsContainer>
            </StyledDropdownMenu>
          )}
        </div>
      </StyledCardHeader>
      
      <StyledCardContent>
        <StyledInfoItem>
          <IconCalendar size={16} />
          Created on {formattedDate}
        </StyledInfoItem>
        
        {jobLocation && (
          <StyledInfoItem>
            <IconMap size={16} />
            {jobLocation}
          </StyledInfoItem>
        )}
        
        <StyledInfoItem>
          <IconUser size={16} />
          {candidateCount} {candidateCount === 1 ? 'Candidate' : 'Candidates'}
        </StyledInfoItem>
      </StyledCardContent>
      
      <StyledCardFooter>
        <StyledActiveStatus isActive={isActive}>
          <IconBriefcase size={16} />
          {isActive ? 'Active' : 'Inactive'}
        </StyledActiveStatus>
      </StyledCardFooter>
    </StyledCard>
  );
}; 