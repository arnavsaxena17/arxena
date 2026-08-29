import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { NavigationDrawerOpenedSection } from '@/navigation-menu-item/display/sections/components/NavigationDrawerOpenedSection';
import { FavoritesSectionDispatcher } from '@/navigation-menu-item/display/sections/favorites/components/FavoritesSectionDispatcher';
import { WorkspaceSectionDispatcher } from '@/navigation-menu-item/display/sections/workspace/components/WorkspaceSectionDispatcher';
import { OutreachHomeNavigationDrawerItem } from '@/navigation/components/OutreachHomeNavigationDrawerItem';
import { OrgChartsNavigationDrawerItems } from '@/navigation/components/OrgChartsNavigationDrawerItems';
import { ProjectsNavigationDrawerItems } from '@/navigation/components/ProjectsNavigationDrawerItems';

// Eager: lazy+Suspense for these hung on /outreach-home next to OutreachHomePage lazy route
const StyledScrollableItemsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
`;

export const MainNavigationDrawerScrollableItems = () => {
  return (
    <StyledScrollableItemsContainer>
      <OutreachHomeNavigationDrawerItem />
      <ProjectsNavigationDrawerItems />
      <OrgChartsNavigationDrawerItems />
      <NavigationDrawerOpenedSection />
      <FavoritesSectionDispatcher />
      <WorkspaceSectionDispatcher />
    </StyledScrollableItemsContainer>
  );
};
