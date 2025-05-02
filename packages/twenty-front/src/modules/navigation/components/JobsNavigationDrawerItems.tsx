import axios from 'axios';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { IconBriefcase } from 'twenty-ui';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { jobsState } from '@/candidate-table/states';
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

type Job = {
  id: string;
  name: string;
  pathPosition?: string;
  isActive: boolean;
};

const StyledSubItemLeftAdornment = styled.div`
  margin-left: ${({ theme }) => theme.spacing(1)};
`;

export const JobsNavigationDrawerItems = () => {
  const [localJobs, setLocalJobs] = useState<Job[]>([]);
  const [jobs, setJobs] = useRecoilState(jobsState);
  const [isLoading, setIsLoading] = useState(true);
  const [tokenPair] = useRecoilState(tokenPairState);
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

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        setIsLoading(true);
        const response = await axios.post(
          `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/get-all-jobs`,
          {},
          { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}`, }, },
        );
        
        if (response.data?.jobs) {
          // Filter active jobs
          const activeJobs = response.data.jobs
            .filter((job: any) => job.node.isActive)
            .map((job: any) => ({
              id: job.node.id,
              name: job.node.name,
              pathPosition: job.node.pathPosition,
              isActive: job.node.isActive,
            }));
          
          console.log('This is the activeJobs:', activeJobs);
          setLocalJobs(activeJobs);
          setJobs(activeJobs); // Store jobs in Recoil state
        }
      } catch (error) {
        console.error('Error fetching jobs:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobs();
  }, [tokenPair, setJobs]);

  const handleItemClick = () => {
    setNavigationDrawerExpandedMemorized(isNavigationDrawerExpanded);
    setIsNavigationDrawerExpanded(true);
    setNavigationMemorizedUrl(location.pathname + location.search);
  };

  if (isLoading || localJobs.length === 0) {
    return null;
  }

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
        {localJobs.map((job, index) => (
          <NavigationDrawerItem
            key={job.id}
            label={job.name}
            to={`/job/${job.id}`}
            onClick={handleItemClick}
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