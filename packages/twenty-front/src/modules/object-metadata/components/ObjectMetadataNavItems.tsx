import { useLocation } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { useIcons } from 'twenty-ui';

import { ObjectMetadataNavItemsSkeletonLoader } from '@/object-metadata/components/ObjectMetadataNavItemsSkeletonLoader';
import { useFilteredObjectMetadataItems } from '@/object-metadata/hooks/useFilteredObjectMetadataItems';
import { useIsPrefetchLoading } from '@/prefetch/hooks/useIsPrefetchLoading';
import { usePrefetchedData } from '@/prefetch/hooks/usePrefetchedData';
import { PrefetchKey } from '@/prefetch/types/PrefetchKey';
import { NavigationDrawerItem } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItem';
import { NavigationDrawerSection } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSection';
import { NavigationDrawerSectionTitle } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSectionTitle';
import { useNavigationSection } from '@/ui/navigation/navigation-drawer/hooks/useNavigationSection';
import { View } from '@/views/types/View';
import { getObjectMetadataItemViews } from '@/views/utils/getObjectMetadataItemViews';

export const ObjectMetadataNavItems = ({ isRemote }: { isRemote: boolean }) => {
  const { toggleNavigationSection, isNavigationSectionOpenState } =
    useNavigationSection('Objects' + (isRemote ? 'Remote' : 'Workspace'));
  const isNavigationSectionOpen = useRecoilValue(isNavigationSectionOpenState);

  const { activeObjectMetadataItems } = useFilteredObjectMetadataItems();
  const filteredActiveObjectMetadataItems = activeObjectMetadataItems.filter(
    (item) => (isRemote ? item.isRemote : !item.isRemote),
  );
  const { getIcon } = useIcons();
  const currentPath = useLocation().pathname;

  const { records: views } = usePrefetchedData<View>(PrefetchKey.AllViews);
  const loading = useIsPrefetchLoading();

  if (loading) {
    return <ObjectMetadataNavItemsSkeletonLoader />;
  }


  // Separate job candidate items
  const jobCandidateItems = filteredActiveObjectMetadataItems.filter((item) =>
    item.nameSingular.endsWith('JobCandidate')
  );


  const excludedItems = [
    'cvsent',
    'clientInterview',
    'recruiterInterview',
    // 'candidateEnrichment',
    'offer',
    'clientContact',
    'candidateReminder',
    'screening',
    'opportunity'
  ];

  const regularItems = filteredActiveObjectMetadataItems.filter(
    (item) => 
      !item.nameSingular.endsWith('JobCandidate') && 
      !excludedItems.includes(item.nameSingular)
  );


  return (
    filteredActiveObjectMetadataItems.length > 0 && (

      <>

      {jobCandidateItems.length > 0 && (
        <NavigationDrawerSection>
          <NavigationDrawerSectionTitle
            label="Job Candidates"
            onClick={() => toggleNavigationSection()}
          />
          {isNavigationSectionOpen &&
            jobCandidateItems.map((objectMetadataItem) => {
              const objectMetadataViews = getObjectMetadataItemViews(
                objectMetadataItem.id,
                views,
              );
              const viewId = objectMetadataViews[0]?.id;

              const navigationPath = `/objects/${objectMetadataItem.namePlural}${
                viewId ? `?view=${viewId}` : ''
              }`;

              return (
                <NavigationDrawerItem
                  key={objectMetadataItem.id}
                  label={objectMetadataItem.labelPlural}
                  to={navigationPath}
                  active={
                    currentPath === `/objects/${objectMetadataItem.namePlural}`
                  }
                  Icon={getIcon(objectMetadataItem.icon)}
                />
              );
            })}
        </NavigationDrawerSection>
      )}


      <NavigationDrawerSection>
        <NavigationDrawerSectionTitle
          label={isRemote ? 'Remote' : 'Workspace'}
          onClick={() => toggleNavigationSection()}
        />

        {isNavigationSectionOpen &&
          [
            ...regularItems
              .filter((item) =>
                ['person', 'company', 'candidate'].includes(
                  item.nameSingular,
                ),
              )
              .sort((objectMetadataItemA, objectMetadataItemB) => {
                const order = ['person', 'company', 'candidate'];
                const indexA = order.indexOf(objectMetadataItemA.nameSingular);
                const indexB = order.indexOf(objectMetadataItemB.nameSingular);
                if (indexA === -1 || indexB === -1) {
                  return objectMetadataItemA.nameSingular.localeCompare(
                    objectMetadataItemB.nameSingular,
                  );
                }
                return indexA - indexB;
              }),
            ...regularItems
              .filter(
                (item) =>
                  !['person', 'company', 'candidate'].includes(
                    item.nameSingular,
                  ),
              )
              .sort((objectMetadataItemA, objectMetadataItemB) => {
                return new Date(objectMetadataItemA.createdAt) <
                  new Date(objectMetadataItemB.createdAt)
                  ? 1
                  : -1;
              }),
          ].map((objectMetadataItem) => {
            const objectMetadataViews = getObjectMetadataItemViews(
              objectMetadataItem.id,
              views,
            );
            const viewId = objectMetadataViews[0]?.id;

            const navigationPath = `/objects/${objectMetadataItem.namePlural}${
              viewId ? `?view=${viewId}` : ''
            }`;

            return (
              <NavigationDrawerItem
                key={objectMetadataItem.id}
                label={objectMetadataItem.labelPlural}
                to={navigationPath}
                active={
                  currentPath === `/objects/${objectMetadataItem.namePlural}`
                }
                Icon={getIcon(objectMetadataItem.icon)}
              />
            );
          })}
      </NavigationDrawerSection>


      </>

    )
  );
};