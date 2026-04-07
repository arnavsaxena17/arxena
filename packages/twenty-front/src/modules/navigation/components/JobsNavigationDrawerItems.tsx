import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { IconBriefcase, IconPlus, IconUsers, LightIconButton } from 'twenty-ui';

import { useOpenAddJobModal } from '@/arx-jd-upload/hooks/useOpenAddJobModal';
import { useJobRefetch } from '@/candidate-table/hooks/useJobRefetch';
import { jobsRefetchTriggerState, jobsState } from '@/candidate-table/states/states';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { AppPath } from '@/types/AppPath';
import { NavigationDrawerItem } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItem';
import { NavigationDrawerItemGroup } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItemGroup';
import { NavigationDrawerSection } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSection';
import { NavigationDrawerSectionTitle } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSectionTitle';
import { getNavigationSubItemLeftAdornment } from '@/ui/navigation/navigation-drawer/utils/getNavigationSubItemLeftAdornment';
import { isNavigationDrawerExpandedState } from '@/ui/navigation/states/isNavigationDrawerExpanded';
import { navigationDrawerExpandedMemorizedState } from '@/ui/navigation/states/navigationDrawerExpandedMemorizedState';
import { navigationMemorizedUrlState } from '@/ui/navigation/states/navigationMemorizedUrlState';
import { useLingui } from '@lingui/react/macro';
import { getAppPath } from '~/utils/navigation/getAppPath';

// Define the Job type for API response
type ApiJob = {
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
      }
    }>
  }
};

export const JobsNavigationDrawerItems = () => {
  const [localJobs, setLocalJobs] = useState<ApiJob[]>([]);
  const [jobs, setJobs] = useRecoilState(jobsState);
  const jobsRefetchTrigger = useRecoilState(jobsRefetchTriggerState)[0];
  const { refetchJobs } = useJobRefetch();
  const refetchJobsRef = useRef(refetchJobs);
  refetchJobsRef.current = refetchJobs;
  const location = useLocation();
  const { t } = useLingui();
  const { openAddJobModal } = useOpenAddJobModal();

  const { objectMetadataItems } = useObjectMetadataItems();
  const jobMetadataItem = useMemo(
    () => objectMetadataItems.find((item) => item.nameSingular === 'job'),
    [objectMetadataItems],
  );

  const [isNavigationDrawerExpanded, setIsNavigationDrawerExpanded] =
    useRecoilState(isNavigationDrawerExpandedState);
  const setNavigationDrawerExpandedMemorized = useSetRecoilState(
    navigationDrawerExpandedMemorizedState,
  );
  const setNavigationMemorizedUrl = useSetRecoilState(
    navigationMemorizedUrlState,
  );

  // Fetch jobs only when metadata is loaded (avoids findManyJobs during onboarding)
  useEffect(() => {
    if (jobMetadataItem) {
      refetchJobsRef.current();
    }
  }, [jobMetadataItem?.id]);

  // Listen for global job refetch triggers (when metadata is ready)
  useEffect(() => {
    if (jobMetadataItem && jobsRefetchTrigger > 0) {
      refetchJobsRef.current();
    }
  }, [jobMetadataItem?.id, jobsRefetchTrigger]);

  // Update local jobs when global jobs state changes
  useEffect(() => {
    if (jobs.length > 0) {
      setLocalJobs(jobs);
    }
  }, [jobs]);

  const activeJobs = useMemo(
    () => localJobs.filter((job) => job.isActive),
    [localJobs],
  );

  const selectedJobIdFromRoute = useMemo(() => {
    const match = location.pathname.match(/^\/job\/([^/]+)/);
    return match?.[1] ?? null;
  }, [location.pathname]);

  const allJobsPath = `/${AppPath.Jobs}`;
  const isAllJobsRoute =
    location.pathname === allJobsPath ||
    location.pathname.startsWith(`${allJobsPath}/`);
  const isAllJobsActive = isAllJobsRoute && selectedJobIdFromRoute === null;

  const selectedJobIndexInNav = useMemo(() => {
    if (selectedJobIdFromRoute === null) {
      return -1;
    }
    return activeJobs.findIndex((job) => job.id === selectedJobIdFromRoute);
  }, [activeJobs, selectedJobIdFromRoute]);

  const handleItemClick = () => {
    setNavigationDrawerExpandedMemorized(isNavigationDrawerExpanded);
    setIsNavigationDrawerExpanded(true);
    setNavigationMemorizedUrl(location.pathname + location.search);
  };


  return (
    <NavigationDrawerSection>
      <NavigationDrawerSectionTitle
        label={t`Jobs`}
        rightIconAlwaysVisible
        rightIcon={
          <LightIconButton
            Icon={IconPlus}
            accent="tertiary"
            size="small"
            aria-label={t`Add new job`}
            title={t`Add new job`}
            testId="navigation-drawer-jobs-add-job"
            onClick={(event) => {
              event.stopPropagation();
              openAddJobModal();
            }}
          />
        }
      />
      <NavigationDrawerItemGroup>
        <NavigationDrawerItem
          label={t`All Jobs`}
          to={getAppPath(AppPath.Jobs)}
          onClick={handleItemClick}
          Icon={IconBriefcase}
          active={isAllJobsActive}
        />
        {activeJobs.map((job, index) => (
          <NavigationDrawerItem
            key={job.id}
            label={job.name}
            to={`/job/${job.id}`}
            onClick={handleItemClick}
            Icon={IconUsers}
            active={job.id === selectedJobIdFromRoute}
            subItemState={getNavigationSubItemLeftAdornment({
              arrayLength: activeJobs.length,
              index,
              selectedIndex: selectedJobIndexInNav,
            })}
          />
        ))}
      </NavigationDrawerItemGroup>
    </NavigationDrawerSection>
  );
}; 