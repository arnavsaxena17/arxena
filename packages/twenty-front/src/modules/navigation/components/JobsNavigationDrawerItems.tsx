import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { IconBriefcase, IconUsers } from 'twenty-ui';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { useJobRefetch } from '@/candidate-table/hooks/useJobRefetch';
import { jobsRefetchTriggerState, jobsState } from '@/candidate-table/states/states';
import { AppPath } from '@/types/AppPath';
import { NavigationDrawerItem } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItem';
import { NavigationDrawerItemGroup } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItemGroup';
import { NavigationDrawerSection } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSection';
import { NavigationDrawerSectionTitle } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSectionTitle';
import { getNavigationSubItemLeftAdornment } from '@/ui/navigation/navigation-drawer/utils/getNavigationSubItemLeftAdornment';
import { isNavigationDrawerExpandedState } from '@/ui/navigation/states/isNavigationDrawerExpanded';
import { navigationDrawerExpandedMemorizedState } from '@/ui/navigation/states/navigationDrawerExpandedMemorizedState';
import { navigationMemorizedUrlState } from '@/ui/navigation/states/navigationMemorizedUrlState';
import styled from '@emotion/styled';
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

const StyledSubItemLeftAdornment = styled.div`
  margin-left: ${({ theme }) => theme.spacing(1)};
`;

export const JobsNavigationDrawerItems = () => {
  const [localJobs, setLocalJobs] = useState<ApiJob[]>([]);
  const [jobs, setJobs] = useRecoilState(jobsState);
  const [isLoading, setIsLoading] = useState(true);
  const [tokenPair] = useRecoilState(tokenPairState);
  const jobsRefetchTrigger = useRecoilState(jobsRefetchTriggerState)[0];
  const { refetchJobs } = useJobRefetch();
  const refetchJobsRef = useRef(refetchJobs);
  refetchJobsRef.current = refetchJobs;
  const location = useLocation();
  const { t } = useLingui();

  const [isNavigationDrawerExpanded, setIsNavigationDrawerExpanded] =
    useRecoilState(isNavigationDrawerExpandedState);
  const setNavigationDrawerExpandedMemorized = useSetRecoilState(
    navigationDrawerExpandedMemorizedState,
  );
  const setNavigationMemorizedUrl = useSetRecoilState(
    navigationMemorizedUrlState,
  );

  // Initial load when component mounts
  useEffect(() => {
    console.log('JobsNavigationDrawerItems - Component mounted, fetching jobs...');
    refetchJobsRef.current();
  }, []);

  // Listen for global job refetch triggers
  useEffect(() => {
    if (jobsRefetchTrigger > 0) {
      console.log('JobsNavigationDrawerItems - Refetch triggered, updating jobs...');
      refetchJobsRef.current();
    }
  }, [jobsRefetchTrigger]);

  // Update local jobs when global jobs state changes
  useEffect(() => {
    if (jobs.length > 0) {
      console.log('JobsNavigationDrawerItems - Jobs updated from global state:', jobs.length, 'jobs');
      setLocalJobs(jobs);
      setIsLoading(false);
    }
  }, [jobs]);

  const handleItemClick = () => {
    setNavigationDrawerExpandedMemorized(isNavigationDrawerExpanded);
    setIsNavigationDrawerExpanded(true);
    setNavigationMemorizedUrl(location.pathname + location.search);
  };


  return (
    <NavigationDrawerSection>
      <NavigationDrawerSectionTitle label={t`Jobs`} />
      <NavigationDrawerItemGroup>
        <NavigationDrawerItem
          label={t`All Jobs`}
          to={getAppPath(AppPath.Jobs)}
          onClick={handleItemClick}
          Icon={IconBriefcase}
        />
        {localJobs.filter((job) => job.isActive).map((job, index) => (
          <NavigationDrawerItem
            key={job.id}
            label={job.name}
            to={`/job/${job.id}`}
            onClick={handleItemClick}
            Icon={IconUsers}
            subItemState={getNavigationSubItemLeftAdornment({
              arrayLength: localJobs.length,
              index,
              selectedIndex: -1,
            })}
          />
        ))}
      </NavigationDrawerItemGroup>
    </NavigationDrawerSection>
  );
}; 