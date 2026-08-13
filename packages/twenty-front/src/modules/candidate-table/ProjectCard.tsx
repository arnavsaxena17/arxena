import { MenuItem } from 'twenty-ui/navigation';
import {
  IconBriefcase,
  IconCalendar,
  IconCheck,
  IconDotsVertical,
  IconHierarchy2,
  IconMap,
  IconPencil,
  IconTrash,
  IconTrashX,
  IconX,
} from 'twenty-ui/icon';
import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';

import { useDeleteProject } from '@/candidate-table/hooks/useDeleteProject';
import { useProjectStatusToggle } from '@/candidate-table/hooks/useProjectStatusToggle';
import { projectsState } from '@/candidate-table/states/states';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useModal } from '@/ui/layout/modal/hooks/useModal';
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
  background-color: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  height: 150px;
  padding: ${themeCssVariables.spacing[4]};
  position: relative;
  transition: all 0.2s ease-in-out;

  &:hover {
    border-color: ${themeCssVariables.border.color.medium};
    box-shadow: ${themeCssVariables.boxShadow.light};
  }
`;

const StyledCardHeader = styled.div`
  align-items: flex-start;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
  margin-bottom: ${themeCssVariables.spacing[2]};
`;

const StyledMergeCheckbox = styled.div`
  align-items: center;
  cursor: pointer;
  display: flex;
  flex-shrink: 0;
`;

const StyledCardTitle = styled.h3`
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: ${themeCssVariables.font.color.primary};
  display: -webkit-box;
  flex: 1;
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.medium};
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-word;
`;

const StyledCardContent = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledInfoItem = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[1]};
  min-height: 20px;
`;

const StyledCardFooter = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-top: ${themeCssVariables.spacing[2]};
`;

const StyledActiveStatus = styled.div<{ isActive: boolean }>`
  align-items: center;
  color: ${({ isActive }) =>
    isActive ? themeCssVariables.font.color.primary : themeCssVariables.font.color.tertiary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledMenuButton = styled.button`
  align-items: center;
  background: none;
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  display: flex;
  height: 24px;
  justify-content: center;
  padding: 0;
  width: 24px;

  &:hover {
    background-color: ${themeCssVariables.background.tertiary};
  }
`;

const StyledEditableField = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  min-height: 20px;
`;

const StyledEditableInput = styled.input`
  background: none;
  border: 1px solid transparent;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.tertiary};
  flex: 1;
  font-size: ${themeCssVariables.font.size.sm};
  min-height: 20px;
  min-width: 0;
  padding: ${themeCssVariables.spacing[0.5]} ${themeCssVariables.spacing[1]};

  &:focus {
    background-color: ${themeCssVariables.background.secondary};
    border-color: ${themeCssVariables.border.color.medium};
    outline: none;
  }

  &:hover {
    border-color: ${themeCssVariables.border.color.light};
  }
`;

const StyledEditableText = styled.div`
  align-items: center;
  border: 1px solid transparent;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[1]};
  min-height: 20px;
  padding: ${themeCssVariables.spacing[0.5]} ${themeCssVariables.spacing[1]};

  &:hover {
    background-color: ${themeCssVariables.background.tertiary};
    border-color: ${themeCssVariables.border.color.light};
  }
`;

const StyledEditButton = styled.button`
  align-items: center;
  background: none;
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  display: flex;
  justify-content: center;
  padding: ${themeCssVariables.spacing[0.5]};

  &:hover {
    background-color: ${themeCssVariables.background.tertiary};
  }
`;

const StyledActionButtons = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[0.5]};
`;

const StyledOrgChartButton = styled.button`
  align-items: center;
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  cursor: pointer;
  display: inline-flex;
  font-size: ${themeCssVariables.font.size.xs};
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[0.5]} ${themeCssVariables.spacing[1.5]};

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
  const { deleteProject, isDeleting } = useDeleteProject();
  const { openModal } = useModal();
  const deleteProjectModalId = `delete-project-modal-${id}`;
  const deleteProjectWithCandidatesModalId = `delete-project-with-candidates-modal-${id}`;
  const [projects, setProjects] = useAtomState(projectsState);
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

  const handleOpenDeleteProjectModal = () => {
    closeDropdown(dropdownId);
    openModal(deleteProjectModalId);
  };

  const handleOpenDeleteProjectWithCandidatesModal = () => {
    closeDropdown(dropdownId);
    openModal(deleteProjectWithCandidatesModalId);
  };

  const handleConfirmDeleteProject = () => {
    void deleteProject(id, { deleteCandidates: false }).catch(() => undefined);
  };

  const handleConfirmDeleteProjectWithCandidates = () => {
    void deleteProject(id, { deleteCandidates: true }).catch(() => undefined);
  };

  const handleSearchNameEdit = () => {
    setIsEditingSearchName(true);
  };

  const handleSearchNameSave = () => {
    if (searchNameValue !== searchName) {
      const updatedJobs = projects.map(job =>
        job.id === id ? { ...job, searchName: searchNameValue } : job
      );
      setProjects(updatedJobs);

      updateProject({
        variables: {
          idToUpdate: id,
          input: {
            searchName: searchNameValue
          }
        },
        onError: (error) => {
          console.error('Failed to update search name:', error);
          setProjects(projects);
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
              <DropdownContent widthInPixels={280}>
                <DropdownMenuItemsContainer>
                  <MenuItem
                    accent={isActive ? 'default' : 'danger'}
                    onClick={handleToggleJobStatus}
                    text={isActive ? 'Mark as Inactive' : 'Mark as Active'}
                    LeftIcon={IconBriefcase}
                  />
                  <MenuItem
                    accent="danger"
                    onClick={handleOpenDeleteProjectModal}
                    text="Delete Project"
                    LeftIcon={IconTrash}
                  />
                  <MenuItem
                    accent="danger"
                    onClick={handleOpenDeleteProjectWithCandidatesModal}
                    text="Delete Project with Candidates"
                    LeftIcon={IconTrashX}
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

      <ConfirmationModal
        modalInstanceId={deleteProjectModalId}
        title="Delete project"
        subtitle={`Delete "${name}" and its project dependencies (prompts, attachments, templates, etc.)? Candidates in this project will not be deleted.`}
        onConfirmClick={handleConfirmDeleteProject}
        confirmButtonText="Delete Project"
        confirmButtonAccent="danger"
        loading={isDeleting}
      />
      <ConfirmationModal
        modalInstanceId={deleteProjectWithCandidatesModalId}
        title="Delete project with candidates"
        subtitle={`Delete "${name}", its dependencies, and soft-delete all candidates in this project? This cannot be easily undone.`}
        onConfirmClick={handleConfirmDeleteProjectWithCandidates}
        confirmButtonText="Delete Project with Candidates"
        confirmButtonAccent="danger"
        loading={isDeleting}
      />
    </StyledCard>
  );
};
