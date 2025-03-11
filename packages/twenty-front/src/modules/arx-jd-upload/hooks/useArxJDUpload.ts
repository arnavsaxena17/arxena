import axios from 'axios';
import Fuse from 'fuse.js';
import { useCallback, useState } from 'react';
import { useRecoilState } from 'recoil';

import { useUploadAttachmentFile } from '@/activities/files/hooks/useUploadAttachmentFile';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { ObjectRecord } from '@/object-record/types/ObjectRecord';

import { ParsedJD } from '../types/ParsedJD';
import { createDefaultParsedJD } from '../utils/createDefaultParsedJD';
import { useArxJDFormStepper } from './useArxJDFormStepper';

export const useArxJDUpload = () => {
  const [tokenPair] = useRecoilState(tokenPairState);
  const [parsedJD, setParsedJD] = useState<ParsedJD | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { createOneRecord } = useCreateOneRecord({ objectNameSingular: 'job' });
  const { updateOneRecord } = useUpdateOneRecord({ objectNameSingular: 'job' });
  const { uploadAttachmentFile } = useUploadAttachmentFile();

  const { records: companies = [] } = useFindManyRecords({
    objectNameSingular: 'company',
  });

  const { reset: resetFormStepper } = useArxJDFormStepper();

  type Company = ObjectRecord & {
    name: string;
  };

  const findBestCompanyMatch = useCallback(
    (companyName: string): Company | null => {
      if (!Array.isArray(companies) || companies.length === 0) {
        return null;
      }

      const companiesWithName = companies.filter(
        (company): company is Company =>
          typeof company === 'object' &&
          company !== null &&
          'name' in company &&
          typeof company.name === 'string',
      );

      if (companiesWithName.length === 0) {
        return null;
      }

      const fuse = new Fuse(companiesWithName, {
        keys: ['name'],
        threshold: 0.4,
      });

      const result = fuse.search(companyName);
      console.log('result:', result);
      return result.length > 0 ? result[0].item : null;
    },
    [companies],
  );

  const handleFileUpload = useCallback(
    async (acceptedFiles: File[]): Promise<void> => {
      if (acceptedFiles.length === 0) {
        return;
      }

      setError(null);
      setIsUploading(true);
      const file = acceptedFiles[0];

      try {
        const createdJob = await createOneRecord({
          name: file.name.split('.')[0],
        });

        if (createdJob?.id === undefined || createdJob?.id === null) {
          throw new Error('Failed to create job record');
        }

        const { attachmentAbsoluteURL } = await uploadAttachmentFile(file, {
          targetObjectNameSingular: CoreObjectNameSingular.Job,
          id: createdJob.id,
        });

        const response = await axios({
          method: 'post',
          url: `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/upload-jd`,
          data: {
            jobId: createdJob.id,
            attachmentUrl: attachmentAbsoluteURL,
          },
          headers: {
            Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
          },
        });

        console.log('response:', response.data);

        if (response.data.success === true) {
          const data = response.data.data;
          const parsedData = createDefaultParsedJD({
            name: data.name,
            description: data.description,
            jobCode: data.jobCode,
            jobLocation: data.jobLocation,
            salaryBracket: data.salaryBracket,
            isActive: true,
            specificCriteria: data.specificCriteria,
            pathPosition: data.pathPosition,
            companyName: data.companyName,
            companyId: data.companyId,
          });

            if (
            typeof parsedData.companyName === 'string' &&
            parsedData.companyName !== ''
            ) {
            console.log('parsedData:', parsedData);
            const matchedCompany = findBestCompanyMatch(parsedData.companyName);
            console.log('matchedCompany:', matchedCompany);
            const {
              companyName,
              chatFlow,
              videoInterview,
              meetingScheduling,
              ...updateData
            } = parsedData;

            setParsedJD(parsedData);

            if (matchedCompany !== null &&
              typeof matchedCompany?.id === 'string' &&
              matchedCompany.id !== ''
            ) {
              updateData.companyId = matchedCompany.id;
            }

            await updateOneRecord({
              idToUpdate: createdJob.id,
              updateOneRecordInput: updateData,
            });
            } else {
            console.log('parsedData:', parsedData);
            const {
              companyName,
              chatFlow,
              videoInterview,
              meetingScheduling,
              ...updateData
            } = parsedData;
            setParsedJD(parsedData);
            console.log('updateData:', updateData);

            await updateOneRecord({
              idToUpdate: createdJob.id,
              updateOneRecordInput: updateData,
            });
          }
        } else {
          throw new Error(response.data.message || 'Failed to process JD');
        }
      } catch (error: any) {
        console.error('Error processing JD:', error);
        setError(error?.message || 'Failed to process JD');
        setParsedJD(null);
      } finally {
        setIsUploading(false);
      }
    },
    [
      tokenPair?.accessToken?.token,
      createOneRecord,
      updateOneRecord,
      uploadAttachmentFile,
      findBestCompanyMatch,
      setParsedJD,
    ],
  );

  const handleCreateJob = async () => {
    if (parsedJD === null) {
      return;
    }

    try {
      if (
        typeof parsedJD.companyName === 'string' &&
        parsedJD.companyName !== ''
      ) {
        const matchedCompany = findBestCompanyMatch(parsedJD.companyName);
        if (
          matchedCompany !== null &&
          typeof matchedCompany.id === 'string' &&
          matchedCompany.id !== ''
        ) {
          const { companyName, ...jobData } = parsedJD;
          await createOneRecord({
            ...jobData,
            companyId: matchedCompany.id,
          });
        }
      } else {
        await createOneRecord({
          ...parsedJD,
        });
      }
      return true;
    } catch (error) {
      console.error('Error creating job:', error);
      return false;
    }
  };

  // Reset all upload-related state
  const resetUploadState = useCallback(() => {
    // Force reset all state to initial values regardless of current state
    // These are local useState hooks so they won't trigger any Recoil circular updates
    setParsedJD(null);
    setError(null);
    setIsUploading(false);
  }, []);

  return {
    parsedJD,
    setParsedJD,
    isUploading,
    error,
    handleFileUpload,
    handleCreateJob,
    resetUploadState,
  };
};
