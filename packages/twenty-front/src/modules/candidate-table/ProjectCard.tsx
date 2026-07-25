import { MenuItem } from 'twenty-ui/navigation';
import { IconBriefcase, IconCalendar, IconCheck, IconDotsVertical, IconMap, IconPencil, IconX } from 'twenty-ui/icon';
import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { IconHierarchy2 } from 'twenty-ui/icon';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';

import { useProjectStatusToggle } from '@/candidate-table/hooks/useProjectStatusToggle';
import { projectsState } from '@/candidate-table/states/states';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { isNavigationDrawerExpandedState } from '@/ui/navigation/states/isNavigationDrawerExpanded';
import { navigationDrawerExpandedMemorizedState } from '@/ui/navigation/states/navigationDrawerExpandedMemorizedState';
import { navigationMemorizedUrlState } from '@/ui/navigation/states/navigationMemorizedUrlState';
import { UpdateOneProject } from 'twenty-shared/graphql';

type ProjectCardProps = {
  id: string;
  name: string;
  createdAt: string;
  isActive: boolean;
  jobLocation?: string;
  searchName?: string;
  candidateCount?: number;
  isMergeMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (projectId: string) => void;
  onOpenOrgChart?: (projectId: string, jobName: string) => void;
};

const StyledCard = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  padding: ${themeCssVariables.spacing[4]};
  background-color: ${themeCssVariables.background.primary};
  transition: all 0.2s ease-in-out;
  height: 150px;
  position: relative;
  cursor: pointer;

  &:hover {
    box-shadow: ${themeCssVariables.boxShadow.light};
    border-color: ${themeCssVariables.border.color.medium};
  }
`;

const StyledCardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: ${themeCssVariables.spacing[2]};
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledMergeCheckbox = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  cursor: pointer;
`;

const StyledCardTitle = styled.h3`
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.font.color.primary};
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
  flex: 1;
  min-width: 0;
`;

const StyledCardContent = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledInfoItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  min-height: 20px;
`;

const StyledCardFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: ${themeCssVariables.spacing[2]};
`;

const StyledActiveStatus = styled.div<{ isActive: boolean }>`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  color: ${({ isActive }) =>
    isActive ? themeCssVariables.font.color.primary : themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledMenuButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${themeCssVariables.font.color.tertiary};
  height: 24px;
  width: 24px;
  padding: 0;
  border-radius: ${themeCssVariables.border.radius.sm};

  &:hover {
    background-color: ${themeCssVariables.background.tertiary};
  }
`;

const StyledEditableField = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  min-height: 20px;
`;

const StyledEditableInput = styled.input`
  background: none;
  border: 1px solid transparent;
  border-radius: ${themeCssVariables.border.radius.sm};
  padding: ${themeCssVariables.spacing[0.5]} ${themeCssVariables.spacing[1]};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.tertiary};
  flex: 1;
  min-width: 0;
  min-height: 20px;

  &:focus {
    outline: none;
    border-color: ${themeCssVariables.border.color.medium};
    background-color: ${themeCssVariables.background.secondary};
  }

  &:hover {
    border-color: ${themeCssVariables.border.color.light};
  }
`;

const StyledEditableText = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  cursor: pointer;
  padding: ${themeCssVariables.spacing[0.5]} ${themeCssVariables.spacing[1]};
  border-radius: ${themeCssVariables.border.radius.sm};
  border: 1px solid transparent;
  min-height: 20px;

  &:hover {
    background-color: ${themeCssVariables.background.tertiary};
    border-color: ${themeCssVariables.border.color.light};
  }
`;

const StyledEditButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${themeCssVariables.font.color.tertiary};
  padding: ${themeCssVariables.spacing[0.5]};
  border-radius: ${themeCssVariables.border.radius.sm};

  &:hover {
    background-color: ${themeCssVariables.background.tertiary};
  }
`;

const StyledActionButtons = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[0.5]};
`;

const StyledOrgChartButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[0.5]} ${themeCssVariables.spacing[1.5]};
  border-radius: ${themeCssVariables.border.radius.sm};
  border: 1px solid ${themeCssVariables.border.color.light};
  background: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.xs};
  cursor: pointer;

  &:hover {
    background-color: ${themeCssVariables.background.tertiary};
    border-color: ${themeCssVariables.border.color.medium};
  }
`;

export const ProjectCard = ({
  id,
  name,
  createdAt,
  isActive,
  jobLocation,
  searchName,
  isMergeMode,
  isSelected,
  onToggleSelect,
  onOpenOrgChart,
}: ProjectCardProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dropdownId = `job-card-dropdown-${id}`;
  const { closeDropdown } = useCloseDropdown();
  const [isNavigationDrawerExpanded, setIsNavigationDrawerExpanded] =
    useAtomState(isNavigationDrawerExpandedState);
  const setNavigationDrawerExpandedMemorized = useSetAtomState(
    navigationDrawerExpandedMemorizedState,
  );
  const setNavigationMemorizedUrl = useSetAtomState(
    navigationMemorizedUrlState,
  );

  const { toggleJobStatus } = useProjectStatusToggle({
    projectId: id,
    currentJobActive: isActive
  });
  const [jobs, setJobs] = useAtomState(projectsState);
  const apolloCoreClient = useApolloCoreClient();
  const [updateProject] = useMutation(gql(UpdateOneProject), {
    client: apolloCoreClient,
  });
  const [isEditingSearchName, setIsEditingSearchName] = useState(false);
  const [searchNameValue, setSearchNameValue] = useState(searchName || '');

  const formattedDate = new Date(createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleCardClick = (event: React.MouseEvent) => {
    // Don't navigate if clicking on the menu button or dropdown
    if ((event.target as HTMLElement).closest('.menu-container')) {
      return;
    }
    if ((event.target as HTMLElement).closest('.merge-checkbox')) {
      return;
    }

    if (isMergeMode && onToggleSelect) {
      onToggleSelect(id);
      return;
    }

    setNavigationDrawerExpandedMemorized(isNavigationDrawerExpanded);
    setIsNavigationDrawerExpanded(true);
    setNavigationMemorizedUrl(location.pathname + location.search);
    navigate(`/project/${id}`);
  };

  const handleToggleJobStatus = () => {
    toggleJobStatus();
    closeDropdown(dropdownId);
  };

  const handleSearchNameEdit = () => {
    setIsEditingSearchName(true);
  };

  const handleSearchNameSave = () => {
    if (searchNameValue !== searchName) {
      const updatedJobs = jobs.map(job =>
        job.id === id ? { ...job, searchName: searchNameValue } : job
      );
      setJobs(updatedJobs);

      updateProject({
        variables: {
          idToUpdate: id,
          input: {
            searchName: searchNameValue
          }
        },
        onError: (error) => {
          console.error('Failed to update search name:', error);
          setJobs(jobs);
          setSearchNameValue(searchName || '');
        }
      });
    }
    setIsEditingSearchName(false);
  };

  const handleSearchNameCancel = () => {
    setSearchNameValue(searchName || '');
    setIsEditingSearchName(false);
  };

  const handleSearchNameKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSearchNameSave();
    } else if (event.key === 'Escape') {
      handleSearchNameCancel();
    }
  };

  return (
    <StyledCard onClick={handleCardClick}>
      <StyledCardHeader>
        {isMergeMode && (
          <StyledMergeCheckbox
            className="merge-checkbox"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.(id);
            }}
          >
            <input
              type="checkbox"
              checked={!!isSelected}
              onChange={() => onToggleSelect?.(id)}
              onClick={(e) => e.stopPropagation()}
            />
          </StyledMergeCheckbox>
        )}
        <StyledCardTitle>{name}</StyledCardTitle>
        <div className="menu-container" onClick={(e) => e.stopPropagation()}>
          <Dropdown
            dropdownId={dropdownId}
            dropdownPlacement="bottom-end"
            clickableComponent={
              <StyledMenuButton type="button">
                <IconDotsVertical size={16} />
              </StyledMenuButton>
            }
            dropdownComponents={
              <DropdownContent widthInPixels={200}>
                <DropdownMenuItemsContainer>
                  <MenuItem
                    accent={isActive ? 'default' : 'danger'}
                    onClick={handleToggleJobStatus}
                    text={isActive ? 'Mark as Inactive' : 'Mark as Active'}
                    LeftIcon={IconBriefcase}
                  />
                </DropdownMenuItemsContainer>
              </DropdownContent>
            }
          />
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

        <StyledEditableField onClick={(e) => e.stopPropagation()}>
          {isEditingSearchName ? (
            <>
              <StyledEditableInput
                value={searchNameValue}
                onChange={(e) => setSearchNameValue(e.target.value)}
                onKeyDown={handleSearchNameKeyDown}
                placeholder="Enter search name..."
                autoFocus
              />
              <StyledActionButtons>
                <StyledEditButton onClick={handleSearchNameSave}>
                  <IconCheck size={14} />
                </StyledEditButton>
                <StyledEditButton onClick={handleSearchNameCancel}>
                  <IconX size={14} />
                </StyledEditButton>
              </StyledActionButtons>
            </>
          ) : (
            <StyledEditableText onClick={handleSearchNameEdit}>
              <IconPencil size={14} />
              {searchName || 'Search remarks...'}
            </StyledEditableText>
          )}
        </StyledEditableField>

        {/* <StyledInfoItem> */}
        {/* <IconUser size={16} /> */}
        {/* {candidateCount} {candidateCount === 1 ? 'Candidate' : 'Candidates'} */}
        {/* </StyledInfoItem> */}
      </StyledCardContent>

      <StyledCardFooter>
        <StyledActiveStatus isActive={isActive}>
          <IconBriefcase size={16} />
          {isActive ? 'Active' : 'Inactive'}
        </StyledActiveStatus>
        {onOpenOrgChart && (
          <StyledOrgChartButton
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenOrgChart(id, name);
            }}
          >
            <IconHierarchy2 size={14} />
            Org chart
          </StyledOrgChartButton>
        )}
      </StyledCardFooter>
    </StyledCard>
  );
};
