import { OrgChartDiagramLoader } from './OrgChartDiagramLoader';

export default function OrgChartLoading() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        width: '100%',
      }}
    >
      <OrgChartDiagramLoader />
    </div>
  );
}
