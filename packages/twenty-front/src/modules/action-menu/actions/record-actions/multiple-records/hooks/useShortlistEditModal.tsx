import { useDownloadCVs } from '@/object-record/hooks/useDownloadCVs';
import axios from 'axios';
import { CellChange } from 'handsontable/common';
import { useCallback, useEffect, useState } from 'react';

interface ShortlistData {
  id?: string;
  candidateId: string;
  name: string;
  age: string;
  yearsOfExperience: string;
  educationalQualifications: string;
  universityCollege: string;
  currentJobTitle: string;
  currentCompany: string;
  currentLocation: string;
  currentRoleDescription: string;
  reportsTo: string;
  functionsReportingTo: string;
  reasonForLeaving: string;
  currentSalary: string;
  expectedSalary: string;
  noticePeriod: string;
  email?: string;
  phoneNumber?: string;
}

interface ColumnConfig {
  data: string;
  title: string;
  type?: string;
  width?: number;
  editor?: string;
}

export const useShortlistEditModal = (
  candidateIds: string[],
  jobId: string,
  apiToken?: string,
  isOpen?: boolean
) => {
  const [shortlistData, setShortlistData] = useState<ShortlistData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCreatingShortlist, setIsCreatingShortlist] = useState(false);
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [isDownloadingQuick, setIsDownloadingQuick] = useState(false);
  
  const { sendDownloadCVsRequest, loading: downloadCVsLoading } = useDownloadCVs();

  const columns: ColumnConfig[] = [
    { data: 'name', title: 'Name', width: 150 },
    { data: 'age', title: 'Age', width: 80 },
    { data: 'yearsOfExperience', title: 'Years of Experience', width: 120 },
    { data: 'educationalQualifications', title: 'Education', width: 200 },
    { data: 'universityCollege', title: 'University/College', width: 200 },
    { data: 'currentJobTitle', title: 'Current Job Title', width: 180 },
    { data: 'currentCompany', title: 'Current Company', width: 180 },
    { data: 'currentLocation', title: 'Current Location', width: 150 },
    { data: 'currentRoleDescription', title: 'Role Description', width: 250 },
    { data: 'reportsTo', title: 'Reports To', width: 150 },
    { data: 'functionsReportingTo', title: 'Functions Reporting To', width: 200 },
    { data: 'reasonForLeaving', title: 'Reason for Leaving', width: 200 },
    { data: 'currentSalary', title: 'Current Salary', width: 120 },
    { data: 'expectedSalary', title: 'Expected Salary', width: 120 },
    { data: 'noticePeriod', title: 'Notice Period', width: 120 },
    { data: 'email', title: 'Email', width: 200 },
    { data: 'phoneNumber', title: 'Phone Number', width: 150 },
    { data: 'position', title: 'Position', width: 150 },
    { data: 'jobId', title: 'Job ID', width: 150 },
  ];

  const loadShortlistData = useCallback(async () => {
    if (!apiToken || candidateIds.length === 0 || !isOpen) return;

    try {
      setIsLoading(true);
      setError(null);

      // First, create CV sent record
    //   const cvSentResponse = await axios.post(
    //     `${process.env.REACT_APP_SERVER_BASE_URL}/arx-delivery/create-shortlist-document`,
    //     {
    //       candidateIds,
    //       jobId,
    //       createExcelFile: false,
    //       processWithLLM: true,
    //     },
    //     {
    //       headers: { Authorization: `Bearer ${apiToken}` },
    //     }
    //   );

    //   if (!cvSentResponse.data.success) {
    //     throw new Error(cvSentResponse.data.error || 'Failed to create shortlist document');
    //   }
        console.log('Fetching shortlists for candidates:', candidateIds);
        console.log('Fetching shortlists for jobId :', jobId);
      // Fetch existing shortlists for these candidates
      const shortlistResponse = await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/arx-delivery/get-shortlists-by-candidate-ids`,
        {
          candidateIds,
          jobId,
        },
        {
          headers: { Authorization: `Bearer ${apiToken}` },
        }
      );

      const shortlists = shortlistResponse.data.shortlists || [];
      console.log('Shortlists response from server:', shortlistResponse.data);
      // If no shortlists exist, create initial data from candidates
      if (shortlists.length === 0) {
        const requestBody = { jobId };
        console.log("This is the request body in loadShortlistData::::", requestBody);
        const candidatesResponse = await axios.post(
          `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/get-candidates-by-job-id`,
          requestBody,
          { headers: { Authorization: `Bearer ${apiToken}` } }
        );

        const candidates = candidatesResponse.data.filter((candidate: any) => 
          candidateIds.includes(candidate.id)
        );

        const initialData: ShortlistData[] = candidates.map((candidate: any) => ({
          id: '',
          candidateId: candidate.id,
          name: candidate.name || '',
          age: '',
          yearsOfExperience: '',
          educationalQualifications: '',
          universityCollege: '',
          currentJobTitle: '',
          currentCompany: '',
          currentLocation: '',
          currentRoleDescription: '',
          reportsTo: '',
          functionsReportingTo: '',
          reasonForLeaving: '',
          currentSalary: '',
          expectedSalary: '',
          noticePeriod: '',
          email: candidate.people?.email || '',
          phoneNumber: candidate.phoneNumber || '',
        }));

        setShortlistData(initialData);
      } else {
        // Convert shortlists to editable format
        console.log('Processing existing shortlists:', shortlists);
        const editableData: ShortlistData[] = shortlists.map((shortlist: any) => {
          console.log('Processing shortlist:', shortlist);
          return {
            id: shortlist.id,
            candidateId: shortlist.candidateId,
            name: shortlist.name || shortlist.fullName || '',
            age: shortlist.age || '',
            yearsOfExperience: shortlist.yearsOfExperience || '',
            educationalQualifications: shortlist.educationalQualifications || '',
            universityCollege: shortlist.universityCollege || '',
            currentJobTitle: shortlist.currentJobTitle || '',
            currentCompany: shortlist.currentCompany || '',
            currentLocation: shortlist.currentLocation || '',
            currentRoleDescription: shortlist.currentRoleDescription || '',
            reportsTo: shortlist.reportsTo || '',
            functionsReportingTo: shortlist.functionsReportingTo || '',
            reasonForLeaving: shortlist.reasonForLeaving || '',
            currentSalary: shortlist.currentSalary || '',
            expectedSalary: shortlist.expectedSalary || '',
            noticePeriod: shortlist.noticePeriod || '',
            email: shortlist.candidate?.email?.primaryEmail || '',
            phoneNumber: shortlist.candidate?.phoneNumber?.primaryPhoneNumber || '',
          };
        });

        console.log('Converted shortlist data:', editableData);
        setShortlistData(editableData);
      }
    } catch (err) {
      console.error('Error loading shortlist data:', err);
      const errorMessage = err instanceof Error 
        ? err.message 
        : typeof err === 'object' && err !== null 
          ? JSON.stringify(err)
          : 'Failed to load shortlist data';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [candidateIds, jobId, apiToken, isOpen]);

  const updateShortlistData = useCallback((changes: CellChange[]) => {
    console.log('updateShortlistData called with changes:', changes);
    setShortlistData(prevData => {
      const newData = [...prevData];
      
      changes.forEach(change => {
        const [row, col, oldValue, newValue] = change;
        console.log('Processing change:', { row, col, oldValue, newValue });
        if (typeof row === 'number' && typeof col === 'number' && 
            row >= 0 && row < newData.length && col >= 0 && col < columns.length) {
          const fieldName = columns[col].data;
          if (typeof fieldName === 'string') {
            // Keep all values as strings to match database schema
            let convertedValue = newValue === null || newValue === undefined ? '' : String(newValue);
            
            console.log(`Updating row ${row}, field ${fieldName} from ${oldValue} to ${convertedValue}`);
            newData[row] = {
              ...newData[row],
              [fieldName]: convertedValue,
            };
          }
        }
      });
      
      return newData;
    });
  }, [columns]);

  const saveShortlistData = useCallback(async () => {
    console.log('saveShortlistData called with data:', { shortlistData, jobId, apiToken: !!apiToken });
    if (!apiToken) {
      console.log('No API token available, skipping save');
      return;
    }

    try {
      console.log('Shortlist data to send:', shortlistData);
      console.log('Each shortlist item:', shortlistData.map(item => ({ id: item.id, candidateId: item.candidateId, name: item.name })));
      setIsSaving(true);
      console.log('Sending save request to:', `${process.env.REACT_APP_SERVER_BASE_URL}/arx-delivery/save-shortlist-data`);

      const response = await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/arx-delivery/save-shortlist-data`,
        {
          shortlistData,
          jobId,
        },
        {
          headers: { Authorization: `Bearer ${apiToken}` },
        }
      );
      
      console.log('Save response:', response.data);
    } catch (err) {
      console.error('Error saving shortlist data:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [shortlistData, jobId, apiToken]);

  const downloadResumes = useCallback(async () => {
    try {
      setIsDownloading(true);
      await sendDownloadCVsRequest(candidateIds);
    } catch (err) {
      console.error('Error downloading resumes:', err);
      throw err;
    } finally {
      setIsDownloading(false);
    }
  }, [candidateIds, sendDownloadCVsRequest]);

  const downloadShortlistDocument = useCallback(async () => {
    if (!apiToken) return;

    try {
      setIsDownloading(true);

      const response = await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/arx-delivery/download-shortlist-document`,
        { candidateIds, jobId, },
        { headers: { Authorization: `Bearer ${apiToken}` } }
      );

      if (response.data.success && response.data.fileBuffer) {
        // Convert base64 to blob
        const byteCharacters = atob(response.data.fileBuffer);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', response.data.fileName || `shortlist-document-${Date.now()}.docx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } else {
        throw new Error(response.data.error || 'Failed to download document');
      }
    } catch (err) {
      console.error('Error downloading shortlist document:', err);
      throw err;
    } finally {
      setIsDownloading(false);
    }
  }, [candidateIds, jobId, apiToken]);

  const downloadShortlistDocumentQuick = useCallback(async () => {
    if (!apiToken) return;

    try {
      setIsDownloadingQuick(true);

      const response = await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/arx-delivery/download-shortlist-document-quick`,
        { candidateIds, jobId },
        { headers: { Authorization: `Bearer ${apiToken}` } }
      );

      if (response.data.success && response.data.fileBuffer) {
        // Convert base64 to blob
        const byteCharacters = atob(response.data.fileBuffer);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', response.data.fileName || `shortlist-document-${Date.now()}.docx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } else {
        throw new Error(response.data.error || 'Failed to download document');
      }
    } catch (err) {
      console.error('Error downloading shortlist document (quick):', err);
      throw err;
    } finally {
      setIsDownloadingQuick(false);
    }
  }, [candidateIds, jobId, apiToken]);

  const downloadExcelFile = useCallback(async () => {
    if (!apiToken) return;

    try {
      setIsDownloading(true);

      const response = await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/arx-delivery/download-shortlist-excel`,
        {
          shortlistData,
          jobId,
        },
        {
          headers: { Authorization: `Bearer ${apiToken}` },
        }
      );

      if (response.data.success && response.data.fileBuffer) {
        // Convert base64 to blob
        const byteCharacters = atob(response.data.fileBuffer);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', response.data.fileName || `shortlist-${Date.now()}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } else {
        throw new Error(response.data.error || 'Failed to download Excel file');
      }
    } catch (err) {
      console.error('Error downloading Excel file:', err);
      throw err;
    } finally {
      setIsDownloading(false);
    }
  }, [shortlistData, jobId, apiToken]);

  const createShortlistCandidates = useCallback(async () => {
    if (!apiToken) return;

    try {
      setIsCreatingShortlist(true);
      
      const response = await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/arx-delivery/create-shortlist-candidates`,
        {
          candidateIds,
          jobId,
        },
        {
          headers: { Authorization: `Bearer ${apiToken}` },
        }
      );

      if (response.data.success) {
        // Reload shortlist data after processing
        await loadShortlistData();
      } else {
        throw new Error(response.data.error || 'Failed to create shortlist candidates');
      }
    } catch (err) {
      console.error('Error creating shortlist candidates:', err);
      throw err;
    } finally {
      setIsCreatingShortlist(false);
    }
  }, [candidateIds, jobId, apiToken, loadShortlistData]);

  const createGmailDraft = useCallback(async () => {
    if (!apiToken) return;

    try {
      setIsCreatingDraft(true);
      
      const response = await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/arx-delivery/create-gmail-draft-shortlist`,
        {
          candidateIds,
          origin: window.location.origin,
        },
        {
          headers: { Authorization: `Bearer ${apiToken}` },
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to create Gmail draft');
      }
    } catch (err) {
      console.error('Error creating Gmail draft:', err);
      throw err;
    } finally {
      setIsCreatingDraft(false);
    }
  }, [candidateIds, apiToken]);

  useEffect(() => {
    if (isOpen) {
      loadShortlistData();
    } else {
      // Reset state when modal is closed to prevent stale data
      setShortlistData([]);
      setError(null);
      setIsLoading(false);
    }
  }, [loadShortlistData, isOpen]);

  // Debug: Log shortlist data changes
  useEffect(() => {
    console.log('Shortlist data updated:', shortlistData);
  }, [shortlistData]);

  return {
    shortlistData,
    isLoading,
    error,
    columns,
    updateShortlistData,
    saveShortlistData,
    downloadResumes,
    downloadShortlistDocument,
    downloadShortlistDocumentQuick,
    downloadExcelFile,
    createShortlistCandidates,
    createGmailDraft,
    isSaving,
    isDownloading,
    isDownloadingQuick,
    isCreatingShortlist,
    isCreatingDraft,
  };
};
