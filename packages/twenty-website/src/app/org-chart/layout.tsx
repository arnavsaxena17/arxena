import { OrgChartHeader } from '../_components/orgchart/OrgChartHeader';

export default function OrgChartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <OrgChartHeader />
      {children}
    </>
  );
}
