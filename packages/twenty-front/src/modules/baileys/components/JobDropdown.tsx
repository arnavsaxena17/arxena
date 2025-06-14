import React, { useEffect } from 'react';
import { JobDropdownProps } from "twenty-shared";

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



const JobDropdown: React.FC<JobDropdownProps> = ({ jobs, selectedJob, onJobChange }) => {
    useEffect(() => {
        console.log("Jobs received in JobDropdown:", jobs); // Debug log
      }, [jobs]);
    
  return (
    <DropdownContainer>
      <Select value={selectedJob} onChange={(e) => onJobChange(e.target.value)}>
        <option value="">Show All Jobs</option>
        {jobs?.map((job) => (
          <option key={job.id} value={job.id}>
            {job.name}
          </option>
        ))}
      </Select>
    </DropdownContainer>
  );
};

export default JobDropdown;