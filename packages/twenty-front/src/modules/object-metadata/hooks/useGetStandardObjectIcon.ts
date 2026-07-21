import { IconColor } from 'twenty-ui';
import { IconComponent } from 'twenty-ui';
import { IconCheckbox, IconNotes } from 'twenty-ui/icons';
import { useTheme } from '@emotion/react';

export const useGetStandardObjectIcon = (objectNameSingular: string) => {
  const theme = useTheme();

  const getIconForObjectType = (
    objectType: string,
  ): IconComponent | undefined => {
    switch (objectType) {
      case 'note':
        return IconNotes;
      case 'task':
        return IconCheckbox;
      default:
        return undefined;
    }
  };

  const getIconColorForObjectType = (objectType: string): string => {
    switch (objectType) {
      case 'note':
        return theme.color.yellow;
      case 'task':
        return theme.color.blue;
      default:
        return 'currentColor';
    }
  };

  const { Icon, IconColor } = {
    Icon: getIconForObjectType(objectNameSingular),
    IconColor: getIconColorForObjectType(objectNameSingular),
  };

  return { Icon, IconColor };
};
