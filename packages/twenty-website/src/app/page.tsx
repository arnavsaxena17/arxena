import { OrgChartHeader } from './_components/orgchart/OrgChartHeader';
import { ContentContainer } from './_components/ui/layout/ContentContainer';

import { HomepageHero } from './_components/homepage/HomepageHero';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <>
      <OrgChartHeader />
      <ContentContainer>
        <HomepageHero />
      </ContentContainer>
    </>
  );
}
