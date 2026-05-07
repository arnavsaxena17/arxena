import { useWorkspaceFavorites } from '@/favorites/hooks/useWorkspaceFavorites';
import { NavigationDrawerSectionForObjectMetadataItems } from '@/object-metadata/components/NavigationDrawerSectionForObjectMetadataItems';
import { NavigationDrawerSectionForObjectMetadataItemsSkeletonLoader } from '@/object-metadata/components/NavigationDrawerSectionForObjectMetadataItemsSkeletonLoader';
import { useIsPrefetchLoading } from '@/prefetch/hooks/useIsPrefetchLoading';
import { useLingui } from '@lingui/react/macro';

export const WorkspaceFavorites = () => {
  const { workspaceFavoritesObjectMetadataItems } = useWorkspaceFavorites();

  const loading = useIsPrefetchLoading();
  const { t } = useLingui();

  if (loading) {
    return <NavigationDrawerSectionForObjectMetadataItemsSkeletonLoader />;
  }

  const hiddenFavoriteObjectLabels = new Set([
    'interview schedules',
    'client interviews',
    'cv sents',
    'recruiter interviews',
    'shortlists',
    'text messages',
    'phone calls',
    'video interview models',
    'video interview templates',
    'video interview questions',
    'video interview responses',
    'video interviews',
    'client contacts',
    'candidate reminders',
    'tasks',
    'notes',
    'offers',
    'screenings',
  ]);

  const visibleWorkspaceFavoritesObjectMetadataItems =
    workspaceFavoritesObjectMetadataItems.filter((objectMetadataItem) => {
      const singularLabel = objectMetadataItem.labelSingular.toLowerCase().trim();
      const pluralLabel = objectMetadataItem.labelPlural.toLowerCase().trim();

      return (
        !hiddenFavoriteObjectLabels.has(singularLabel) &&
        !hiddenFavoriteObjectLabels.has(pluralLabel)
      );
    });

  return (
    <NavigationDrawerSectionForObjectMetadataItems
      sectionTitle={t`Workspace`}
      objectMetadataItems={visibleWorkspaceFavoritesObjectMetadataItems}
      isRemote={false}
    />
  );
};
