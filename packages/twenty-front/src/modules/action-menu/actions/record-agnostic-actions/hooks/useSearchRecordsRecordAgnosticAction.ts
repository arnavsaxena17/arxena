import { IconSearch } from 'twenty-ui/icons';
import { useCommandMenu } from '@/command-menu/hooks/useCommandMenu';
import { CommandMenuPages } from '@/command-menu/types/CommandMenuPages';

export const useSearchRecordsRecordAgnosticAction = () => {
  const { navigateCommandMenu } = useCommandMenu();

  const onClick = () => {
    navigateCommandMenu({
      page: CommandMenuPages.SearchRecords,
      pageTitle: 'Search',
      pageIcon: IconSearch,
    });
  };

  return {
    onClick,
    shouldBeRegistered: true,
  };
};
