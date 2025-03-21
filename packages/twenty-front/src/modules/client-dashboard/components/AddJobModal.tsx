import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { useCallback, useState } from 'react';
import { Button, H1Title, IconBriefcase, IconUpload } from 'twenty-ui';

import { TextArea } from '@/ui/input/components/TextArea';
import { TextInputV2 } from '@/ui/input/components/TextInputV2';
import { Modal } from '@/ui/layout/modal/components/Modal';
import { isDefined } from 'twenty-shared';

type JobFormData = {
  name: string;
  jobLocation: string;
  jobCode: string;
  description: string;
  salaryBracket: string;
  specificCriteria: string;
};

const initialJobData: JobFormData = {
  name: '',
  jobLocation: '',
  jobCode: '',
  description: '',
  salaryBracket: '',
  specificCriteria: '',
};

type AddJobModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: JobFormData) => void;
};

const StyledModalContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(4)};
  width: 100%;
`;

const StyledHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;

const StyledForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
`;

const StyledInputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledLabel = styled.label`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledButtonContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-top: ${({ theme }) => theme.spacing(4)};
`;

const StyledTabs = styled.div`
  display: flex;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;

const StyledTab = styled.div<{ active: boolean }>`
  border-bottom: 2px solid
    ${({ theme, active }) =>
      active ? theme.border.color.strong : 'transparent'};
  color: ${({ theme, active }) =>
    active ? theme.font.color.primary : theme.font.color.tertiary};
  cursor: pointer;
  font-weight: ${({ theme }) => theme.font.weight.medium};
  padding: ${({ theme }) => theme.spacing(2, 3)};
`;

const StyledUploadArea = styled.div`
  border: 2px dashed ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  padding: ${({ theme }) => theme.spacing(10)};
  text-align: center;
  margin-bottom: ${({ theme }) => theme.spacing(6)};
  position: relative;
`;

export const AddJobModal = ({
  isOpen,
  onClose,
  onSubmit,
}: AddJobModalProps) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<'form' | 'upload'>('form');
  const [formData, setFormData] = useState<JobFormData>(initialJobData);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const handleTextInputChange = useCallback(
    (name: string) => (value: string) => {
      setFormData((prev) => ({ ...prev, [name]: value }));
    },
    [],
  );

  const handleTextAreaChange = useCallback((value: string) => {
    setFormData((prev) => ({ ...prev, description: value }));
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(formData);
    },
    [formData, onSubmit],
  );

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // eslint-disable-next-line @nx/workspace-explicit-boolean-predicates-in-if
      if (isDefined(e.target.files) && e.target.files[0]) {
        setUploadedFile(e.target.files[0]);
      }
    },
    [],
  );

  if (isOpen !== true) {
    return null;
  }

  return (
    <Modal size="large" isClosable={true} onClose={onClose}>
      <StyledModalContent>
        <StyledHeader>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconBriefcase size={24} />
            <H1Title title="Add New Job" />
          </div>
        </StyledHeader>

        <StyledTabs>
          <StyledTab
            active={activeTab === 'form'}
            onClick={() => setActiveTab('form')}
          >
            Manual Entry
          </StyledTab>
          <StyledTab
            active={activeTab === 'upload'}
            onClick={() => setActiveTab('upload')}
          >
            Upload JD
          </StyledTab>
        </StyledTabs>

        {activeTab === 'form' ? (
          <StyledForm onSubmit={handleSubmit}>
            <StyledInputGroup>
              <StyledLabel htmlFor="name">Job Title</StyledLabel>
              <TextInputV2
                id="name"
                name="name"
                placeholder="Enter job title"
                value={formData.name}
                onChange={handleTextInputChange('name')}
                fullWidth
                required
              />
            </StyledInputGroup>

            <StyledInputGroup>
              <StyledLabel htmlFor="jobLocation">Location</StyledLabel>
              <TextInputV2
                id="jobLocation"
                name="jobLocation"
                placeholder="Enter job location"
                value={formData.jobLocation}
                onChange={handleTextInputChange('jobLocation')}
                fullWidth
              />
            </StyledInputGroup>

            <StyledInputGroup>
              <StyledLabel htmlFor="jobCode">Job Code</StyledLabel>
              <TextInputV2
                id="jobCode"
                name="jobCode"
                placeholder="Enter job code"
                value={formData.jobCode}
                onChange={handleTextInputChange('jobCode')}
                fullWidth
              />
            </StyledInputGroup>

            <StyledInputGroup>
              <StyledLabel htmlFor="salaryBracket">Salary Range</StyledLabel>
              <TextInputV2
                id="salaryBracket"
                name="salaryBracket"
                placeholder="Enter salary range"
                value={formData.salaryBracket}
                onChange={handleTextInputChange('salaryBracket')}
                fullWidth
              />
            </StyledInputGroup>

            <StyledInputGroup>
              <StyledLabel htmlFor="specificCriteria">
                Specific Requirements
              </StyledLabel>
              <TextInputV2
                id="specificCriteria"
                name="specificCriteria"
                placeholder="Enter specific requirements"
                value={formData.specificCriteria}
                onChange={handleTextInputChange('specificCriteria')}
                fullWidth
              />
            </StyledInputGroup>

            <StyledInputGroup>
              <StyledLabel htmlFor="description">Job Description</StyledLabel>
              <TextArea
                label=""
                placeholder="Enter job description"
                value={formData.description}
                onChange={handleTextAreaChange}
                minRows={5}
              />
            </StyledInputGroup>

            <StyledButtonContainer>
              <Button title="Cancel" onClick={onClose} variant="secondary" />
              <Button title="Create Job" type="submit" variant="primary" />
            </StyledButtonContainer>
          </StyledForm>
        ) : (
          <div>
            <StyledUploadArea>
              {uploadedFile ? (
                <div>
                  <p>File uploaded: {uploadedFile.name}</p>
                  <Button
                    title="Change File"
                    variant="secondary"
                    onClick={() => setUploadedFile(null)}
                    style={{ marginTop: '16px' }}
                  />
                </div>
              ) : (
                <>
                  <IconUpload
                    size={48}
                    style={{
                      marginBottom: '16px',
                      color: theme.font.color.light,
                    }}
                  />
                  <p>Drag and drop your JD file here or click to browse</p>
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      opacity: 0,
                      cursor: 'pointer',
                    }}
                  />
                </>
              )}
            </StyledUploadArea>

            <StyledButtonContainer>
              <Button title="Cancel" onClick={onClose} variant="secondary" />
              <Button
                title="Process JD"
                variant="primary"
                disabled={!uploadedFile}
                onClick={() => {
                  // Logic to process the uploaded JD
                  // For now, we'll just close the modal
                  onClose();
                }}
              />
            </StyledButtonContainer>
          </div>
        )}
      </StyledModalContent>
    </Modal>
  );
};
