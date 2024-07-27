import { useQuery } from '@apollo/client';
import React from 'react';
import { GET_JOBS } from '../graphql/queries';
import { useNavigationSection } from '@/ui/navigation/navigation-drawer/hooks/useNavigationSection';
import { useRecoilValue } from 'recoil';
import { NavigationDrawerSectionTitle } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSectionTitle';
import { IconBriefcase2, IconSunElectricity } from '@tabler/icons-react';
import { NavigationDrawerItem } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItem';
import { ObjectMetadataNavItemsSkeletonLoader } from './ObjectMetadataNavItemsSkeletonLoader';
import { useLocation } from 'react-router-dom';

export default function JobNavigationSection() {
  const currentPath = useLocation().pathname;
  const navigationSectionJob = useNavigationSection('Jobs');
  const isNavigationSectionOpenJob = useRecoilValue(navigationSectionJob.isNavigationSectionOpenState);
  let jobArray: { jobName: string; jobId: string }[] = [];
  const { loading, data, error } = useQuery(GET_JOBS, {
    variables: {
      filter: {
        isActive: {
          eq: true,
        },
      },
    },
  });
  if (loading) {
    return <ObjectMetadataNavItemsSkeletonLoader />;
  }

  if (data) {
    console.log(data);
    data?.jobs?.edges?.map((job: { node: { name: string; id: string } }) => jobArray.push({ jobName: job?.node?.name, jobId: job?.node?.id }));
    console.log(jobArray);
  }

  return (
    <div>
      <NavigationDrawerSectionTitle label={'Jobs'} onClick={() => navigationSectionJob.toggleNavigationSection()} />
      {jobArray?.map(job => <>{isNavigationSectionOpenJob && <NavigationDrawerItem key={4} label={job?.jobName} to={'/objects/new'} active={currentPath === `jobs/someNumber`} Icon={IconBriefcase2} />}</>)}
    </div>
  );
}
