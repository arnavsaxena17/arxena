import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLingui } from '@lingui/react/macro';
import { AppPath } from 'twenty-shared/types';
import { getAppPath } from 'twenty-shared/utils';
import { IconBriefcase, IconPlus, IconUsers } from 'twenty-ui/icon';
import { LightIconButton } from 'twenty-ui/input';

import { useOpenAddProjectModal } from '@/arx-jd-upload/hooks/useOpenAddProjectModal';
import { useProjectRefetch } from '@/candidate-table/hooks/useProjectRefetch';
import {
  projectsRefetchTriggerState,
  projectsState,
} from '@/candidate-table/states/states';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { NavigationDrawerItem } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItem';
import { NavigationDrawerItemGroup } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItemGroup';
import { NavigationDrawerSection } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSection';
import { NavigationDrawerSectionTitle } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSectionTitle';
import { getNavigationSubItemLeftAdornment } from '@/ui/navigation/navigation-drawer/utils/getNavigationSubItemLeftAdornment';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

type ApiProject = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt?: string;
  jobLocation?: string;
  pathPosition?: string;
  candidates?: {
    edges?: Array<{
      node: {
        id: string;
      };
    }>;
  };
};

export const ProjectsNavigationDrawerItems = () => {
  const [localProjects, setLocalProjects] = useState<ApiProject[]>([]);
  const projects = useAtomStateValue(projectsState);
  const projectsRefetchTrigger = useAtomStateValue(projectsRefetchTriggerState);
  const { refetchJobs } = useProjectRefetch();
  const refetchJobsRef = useRef(refetchJobs);
  refetchJobsRef.current = refetchJobs;
  const location = useLocation();
  const { t } = useLingui();
  const { openAddJobModal } = useOpenAddProjectModal();

  const { objectMetadataItems } = useObjectMetadataItems();
  const projectMetadataItem = useMemo(
    () =>
      objectMetadataItems.find(
        (item) => item.nameSingular === 'project',
      ),
    [objectMetadataItems],
  );

  // Fetch projects only when metadata is loaded (avoids findMany during onboarding)
  useEffect(() => {
    if (projectMetadataItem) {
      refetchJobsRef.current();
    }
  }, [projectMetadataItem?.id]);

  useEffect(() => {
    if (projectMetadataItem && projectsRefetchTrigger > 0) {
      refetchJobsRef.current();
    }
  }, [projectMetadataItem?.id, projectsRefetchTrigger]);

  useEffect(() => {
    if (projects.length > 0) {
      setLocalProjects(projects);
    }
  }, [projects]);

  const activeProjects = useMemo(
    () => localProjects.filter((project) => project.isActive),
    [localProjects],
  );

  const selectedProjectIdFromRoute = useMemo(() => {
    const match = location.pathname.match(/^\/project\/([^/]+)/);

    return match?.[1] ?? null;
  }, [location.pathname]);

  const allProjectsPath = `/${getAppPath(AppPath.Projects)}`;
  const isAllProjectsRoute =
    location.pathname === allProjectsPath ||
    location.pathname.startsWith(`${allProjectsPath}/`);
  const isAllProjectsActive =
    isAllProjectsRoute && selectedProjectIdFromRoute === null;

  const selectedProjectIndexInNav = useMemo(() => {
    if (selectedProjectIdFromRoute === null) {
      return -1;
    }

    return activeProjects.findIndex(
      (project) => project.id === selectedProjectIdFromRoute,
    );
  }, [activeProjects, selectedProjectIdFromRoute]);

  // Do not pass onClick with `to`: useMouseDownNavigation skips navigate(to)
  // whenever onClick is defined, so side-effect-only handlers block navigation.
  return (
    <NavigationDrawerSection>
      <NavigationDrawerSectionTitle
        label={t`Projects`}
        alwaysShowRightIcon
        rightIcon={
          <LightIconButton
            Icon={IconPlus}
            accent="tertiary"
            size="small"
            aria-label={t`Add new project`}
            title={t`Add new project`}
            testId="navigation-drawer-projects-add-project"
            onClick={(event) => {
              event.stopPropagation();
              openAddJobModal();
            }}
          />
        }
      />
      <NavigationDrawerItemGroup>
        <NavigationDrawerItem
          label={t`All Projects`}
          to={allProjectsPath}
          Icon={IconBriefcase}
          active={isAllProjectsActive}
        />
        {activeProjects.map((project, index) => (
          <NavigationDrawerItem
            key={project.id}
            label={project.name}
            to={`/${getAppPath(AppPath.Project, { projectId: project.id })}`}
            Icon={IconUsers}
            active={project.id === selectedProjectIdFromRoute}
            subItemState={getNavigationSubItemLeftAdornment({
              arrayLength: activeProjects.length,
              index,
              selectedIndex: selectedProjectIndexInNav,
            })}
          />
        ))}
      </NavigationDrawerItemGroup>
    </NavigationDrawerSection>
  );
};
