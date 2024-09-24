import React from 'react';
import styled from '@emotion/styled';

const DropdownContainer = styled.div`
  margin-bottom: 1rem;
`;

const Select = styled.select`
  width: 100%;
  padding: 0.5rem;
  border-radius: 4px;
  border: 1px solid #ccc;
`;

interface Job {
  id: string;
  name: string;
}

interface JobDropdownProps {
  jobs: Job[];
  selectedJob: string;
  onJobChange: (jobId: string) => void;
}

const JobDropdown: React.FC<JobDropdownProps> = ({ jobs, selectedJob, onJobChange }) => {
  return (
    <DropdownContainer>
      <Select value={selectedJob} onChange={(e) => onJobChange(e.target.value)}>
        <option value="">Show All Jobs</option>
        {jobs.map((job) => (
          <option key={job.id} value={job.id}>
            {job.name}
          </option>
        ))}
      </Select>
    </DropdownContainer>
  );
};

export default JobDropdown;