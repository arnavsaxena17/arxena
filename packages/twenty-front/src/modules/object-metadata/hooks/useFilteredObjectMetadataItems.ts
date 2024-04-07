import { useRecoilValue } from 'recoil';

import { objectMetadataItemsState } from '@/object-metadata/states/objectMetadataItemsState';

import { getObjectSlug } from '../utils/getObjectSlug';

export const useFilteredObjectMetadataItems = () => {
  const objectMetadataItems = useRecoilValue(objectMetadataItemsState);
  // console.log('This is the objectMetadataItems,', objectMetadataItems);
  const activeObjectMetadataItems = objectMetadataItems.filter(
    ({ isActive, isSystem }) => isActive && !isSystem,
  );
  const inactiveObjectMetadataItems = objectMetadataItems.filter(
    ({ isActive, isSystem }) => !isActive && !isSystem,
  );

  const findActiveObjectMetadataItemBySlug = (slug: string) =>
    activeObjectMetadataItems.find(
      (activeObjectMetadataItem) =>
        getObjectSlug(activeObjectMetadataItem) === slug,
    );

  const findObjectMetadataItemById = (id: string) =>
    objectMetadataItems.find(
      (objectMetadataItem) => objectMetadataItem.id === id,
    );

  const findObjectMetadataItemByNamePlural = (namePlural: string) =>
    objectMetadataItems.find(
      (objectMetadataItem) => objectMetadataItem.namePlural === namePlural,
    );

  return {
    activeObjectMetadataItems,
    findActiveObjectMetadataItemBySlug,
    findObjectMetadataItemById,
    findObjectMetadataItemByNamePlural,
    inactiveObjectMetadataItems,
    objectMetadataItems,
  };
};
