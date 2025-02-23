import * as React from 'react';
import { useState, FC, ReactNode, ComponentProps } from 'react';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useCreateManyRecords } from '@/object-record/hooks/useCreateManyRecords';
import { useRecoilState } from 'recoil';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useModal } from './ModalContext';

import {ResumeUploadModal} from './ResumeUploadModal';



export const useResumesRecordImport = (objectNameSingular: string) => {
  const { openModal, closeModal } = useModal();
  const { enqueueSnackBar } = useSnackBar();
  const [tokenPair] = useRecoilState(tokenPairState);
  
  const { createManyRecords: createManyCandidateRecords } = useCreateManyRecords({
    objectNameSingular: 'candidate',
  });

  const { createManyRecords: createManyPeopleRecords } = useCreateManyRecords({
    objectNameSingular: 'person',
  });

  const uploadResumes = async (files: File[]) => {
    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('resumes', file);
      });

      const url = process.env.ENV_NODE === 'production' 
        ? 'https://your-api.com/upload-resumes' 
        : 'http://localhost:5050/upload-resumes';

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenPair?.accessToken?.token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const parsedData = await response.json();
      
      // Create person records first
      const personRecords = await createManyPeopleRecords(
        parsedData.map((data: any) => ({
          name: {
            firstName: data.firstName,
            lastName: data.lastName,
          },
          email: data.email,
          phone: data.phone,
        }))
      );

      // Create candidate records with person IDs
      const candidateRecords = await createManyCandidateRecords(
        parsedData.map((data: any, index: number) => ({
          peopleId: personRecords[index].id,
          resumeUrl: data.resumeUrl,
        }))
      );

      enqueueSnackBar('Resumes uploaded successfully', {
        variant: SnackBarVariant.Success,
      });

      return candidateRecords;
    } catch (error: any) {
      enqueueSnackBar(error?.message || 'Failed to upload resumes', {
        variant: SnackBarVariant.Error,
      });
      throw error;
    }
  };

  const openResumesUploadModal = () => {
    const content = React.createElement(ResumeUploadModal, {
      onUpload: uploadResumes,
      onClose: closeModal
    });
    openModal(content);
    
  }
  return { 
    openResumesUploadModal,
    uploadResumes 
  };
};