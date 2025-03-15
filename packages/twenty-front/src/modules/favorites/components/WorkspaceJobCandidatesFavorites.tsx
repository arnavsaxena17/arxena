import { useWorkspaceFavorites } from '@/favorites/hooks/useWorkspaceFavorites';
import { NavigationDrawerSectionForObjectMetadataItems } from '@/object-metadata/components/NavigationDrawerSectionForObjectMetadataItems';
import { NavigationDrawerSectionForObjectMetadataItemsSkeletonLoader } from '@/object-metadata/components/NavigationDrawerSectionForObjectMetadataItemsSkeletonLoader';
import { useIsPrefetchLoading } from '@/prefetch/hooks/useIsPrefetchLoading';
import { useLingui } from '@lingui/react/macro';

export const WorkspaceJobCandidatesFavorites = () => {
  const { workspaceFavoritesObjectMetadataItems } = useWorkspaceFavorites();

  const loading = useIsPrefetchLoading();
  const { t } = useLingui();

  console.log(
    'workspaceFavoritesObjectMetadataItems',
    workspaceFavoritesObjectMetadataItems.filter((x) =>
      x.labelSingular.toLowerCase().includes('jobcandidate'),
    ),
  );
  const jobCandidates = workspaceFavoritesObjectMetadataItems.filter((x) =>
    x.labelSingular.toLowerCase().includes('jobcandidate'),
  );

  if (loading) {
    return <NavigationDrawerSectionForObjectMetadataItemsSkeletonLoader />;
  }

  return (
    <NavigationDrawerSectionForObjectMetadataItems
      sectionTitle={t`Job Candidates`}
      objectMetadataItems={jobCandidates}
      isRemote={false}
    />
  );
};
