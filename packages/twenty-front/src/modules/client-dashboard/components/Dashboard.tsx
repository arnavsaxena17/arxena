import styled from '@emotion/styled';
import { useCallback, useState } from 'react';

// eslint-disable-next-line prettier/prettier
import { Table } from '@/ui/layout/table/components/Table';
import { TableCell } from '@/ui/layout/table/components/TableCell';
import { TableHeader } from '@/ui/layout/table/components/TableHeader';
import { TableRow } from '@/ui/layout/table/components/TableRow';
// eslint-disable-next-line prettier/prettier
import { Button, Card, CardContent, CardHeader, H1Title, H2Title, IconArrowUpRight, IconBriefcase, IconFilter, IconPlus, Section, Tag, } from 'twenty-ui';

import { AddJobModal } from './AddJobModal';

// Mock data for active jobs
const mockActiveJobs = [
  {
    id: '1',
    name: 'Senior Frontend Developer',
    location: 'New York, NY',
    createdAt: '2023-08-15',
    candidateCount: 12,
    status: 'Active',
  },
  {
    id: '2',
    name: 'DevOps Engineer',
    location: 'Remote',
    createdAt: '2023-09-01',
    candidateCount: 8,
    status: 'Active',
  },
  {
    id: '3',
    name: 'Product Manager',
    location: 'San Francisco, CA',
    createdAt: '2023-09-10',
    candidateCount: 15,
    status: 'Active',
  },
  {
    id: '4',
    name: 'UX Designer',
    location: 'Chicago, IL',
    createdAt: '2023-09-15',
    candidateCount: 6,
    status: 'Active',
  },
];

// Mock data for recruitment metrics
const mockRecruitmentMetrics = [
  {
    id: '1',
    name: 'Time to First Candidate Contact',
    value: '1.5 days',
    trend: 'down',
    change: '12%',
  },
  {
    id: '2',
    name: 'Closure Rate',
    value: '68%',
    trend: 'up',
    change: '5%',
  },
  {
    id: '3',
    name: 'Time to Shortlist',
    value: '3.2 days',
    trend: 'down',
    change: '8%',
  },
  {
    id: '4',
    name: 'Interviewing Time',
    value: '4.5 days',
    trend: 'up',
    change: '2%',
  },
  {
    id: '5',
    name: 'Time to Close',
    value: '21 days',
    trend: 'down',
    change: '15%',
  },
];

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(6)};
  padding: ${({ theme }) => theme.spacing(4)};
  width: 100%;
`;

const StyledHeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;

const StyledMetricsContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(4)};
  flex-wrap: wrap;
`;

const StyledMetricCard = styled(Card)`
  min-width: 200px;
  width: calc(20% - ${({ theme }) => theme.spacing(4)});
`;

const StyledMetricValue = styled.div`
  font-size: ${({ theme }) => theme.font.size.xl};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  margin: ${({ theme }) => theme.spacing(2, 0)};
`;

const StyledMetricTrend = styled.div<{ trend: 'up' | 'down' }>`
  display: flex;
  align-items: center;
  color: ${({ theme, trend }) =>
    trend === 'up' ? theme.color.green : theme.color.red};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledArrowIcon = styled(IconArrowUpRight)<{ trend: 'up' | 'down' }>`
  margin-right: ${({ theme }) => theme.spacing(1)};
  transform: ${({ trend }) => (trend === 'down' ? 'rotate(90deg)' : 'none')};
`;

const StyledTableContainer = styled(Card)`
  margin-top: ${({ theme }) => theme.spacing(4)};
  width: 100%;
`;

const StyledTag = styled(Tag)<{ status: string }>`
  background-color: ${({ theme, status }) =>
    status === 'Active' ? theme.color.green : theme.color.gray};
  color: ${({ theme }) => theme.font.color.inverted};
`;

const StyledButtonContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

export const Dashboard = () => {
  const [isAddJobModalOpen, setIsAddJobModalOpen] = useState(false);

  const handleOpenAddJobModal = useCallback(() => {
    setIsAddJobModalOpen(true);
  }, []);

  const handleCloseAddJobModal = useCallback(() => {
    setIsAddJobModalOpen(false);
  }, []);

  const handleAddJob = useCallback(() => {
    // Implementation to add job
    setIsAddJobModalOpen(false);
  }, []);

  return (
    <StyledContainer>
      <StyledHeaderContainer>
        <H1Title title="Dashboard" />
        <StyledButtonContainer>
          <Button
            title="Filter"
            Icon={IconFilter}
            variant="secondary"
            onClick={() => {}}
          />
          <Button
            title="Add New Job"
            Icon={IconPlus}
            variant="primary"
            onClick={handleOpenAddJobModal}
          />
        </StyledButtonContainer>
      </StyledHeaderContainer>

      <Section>
        <H2Title title="Recruitment Metrics" />
        <StyledMetricsContainer>
          {mockRecruitmentMetrics.map((metric) => (
            <StyledMetricCard key={metric.id}>
              <CardHeader>{metric.name}</CardHeader>
              <CardContent>
                <StyledMetricValue>{metric.value}</StyledMetricValue>
                <StyledMetricTrend trend={metric.trend as 'up' | 'down'}>
                  <StyledArrowIcon
                    trend={metric.trend as 'up' | 'down'}
                    size={16}
                  />
                  {metric.change}
                </StyledMetricTrend>
              </CardContent>
            </StyledMetricCard>
          ))}
        </StyledMetricsContainer>
      </Section>

      <Section>
        <H2Title title="Active Jobs" />
        <StyledTableContainer>
          <Table>
            <TableRow>
              <TableHeader>Job Title</TableHeader>
              <TableHeader>Location</TableHeader>
              <TableHeader>Created</TableHeader>
              <TableHeader>Candidates</TableHeader>
              <TableHeader>Status</TableHeader>
            </TableRow>
            {mockActiveJobs.map((job) => (
              <TableRow
                key={job.id}
                onClick={() =>
                  (window.location.href = `/jobCandidate/${job.id}`)
                }
              >
                <TableCell>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <IconBriefcase size={16} />
                    {job.name}
                  </div>
                </TableCell>
                <TableCell>{job.location}</TableCell>
                <TableCell>{job.createdAt}</TableCell>
                <TableCell>{job.candidateCount}</TableCell>
                <TableCell>
                  <StyledTag
                    status={job.status}
                    text={job.status}
                    color={job.status === 'Active' ? 'green' : 'gray'}
                  />
                </TableCell>
              </TableRow>
            ))}
          </Table>
        </StyledTableContainer>
      </Section>

      {isAddJobModalOpen && (
        <AddJobModal
          isOpen={isAddJobModalOpen}
          onClose={handleCloseAddJobModal}
          onSubmit={handleAddJob}
        />
      )}
    </StyledContainer>
  );
};
