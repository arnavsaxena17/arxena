import { tokenPairState } from '@/auth/states/tokenPairState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import axios from 'axios';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { useState } from 'react';
import { useRecoilState } from 'recoil';
import { isDefined } from 'twenty-shared';
import { useLazyFindOneRecord } from './useLazyFindOneRecord';

type UseDownloadCVsProps = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

export const useDownloadCVs = ({
  onSuccess,
  onError,
}: UseDownloadCVsProps = {}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tokenPair] = useRecoilState(tokenPairState);
  const { enqueueSnackBar } = useSnackBar();

  const { findOneRecord: findOneCandidateRecord } = useLazyFindOneRecord<any>({
    objectNameSingular: 'candidate',
  });

  const sendDownloadCVsRequest = async (candidateIds: string[]) => {
    if (!candidateIds || candidateIds.length === 0) {
      enqueueSnackBar('No candidates selected for CV download.', {
        variant: SnackBarVariant.Warning,
        duration: 3000,
      });
      return;
    }

    setLoading(true);
    setError(null);
    const zip = new JSZip();
    let filesDownloaded = 0;

    try {
      for (const candidateId of candidateIds) {
        await new Promise<void>((resolve, reject) => {
          findOneCandidateRecord({
            objectRecordId: candidateId,
            onCompleted: async (candidateData) => {
              if (!candidateData) {
                console.warn(`No data found for candidate ID: ${candidateId}`);
                resolve();
                return;
              }
              console.log("candidateData::", candidateData);

              const candidateName = candidateData.name || candidateId;
              const sanitizedCandidateName = candidateName.replace(/[^a-zA-Z0-9_\\-\\/]/g, '_');
              const attachments = candidateData.attachments;

              if (attachments && attachments.length > 0) {
                for (const attachmentNode of attachments) {
                  if (attachmentNode && attachmentNode.fullPath && attachmentNode.name) {
                    if (attachmentNode.type === 'TextDocument' || attachmentNode.name.match(/\\.(pdf|doc|docx)$/i)) {
                      try {
                        const fileResponse = await axios.get(attachmentNode.fullPath, {
                          responseType: 'arraybuffer',
                          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` }
                        });
                        
                        // Create unique filename with candidate name as prefix
                        const fileExtension = attachmentNode.name.split('.').pop() || '';
                        const uniqueFileName = `${attachmentNode.name}`;
                        
                        zip.file(uniqueFileName, fileResponse.data, { binary: true });
                        filesDownloaded++;
                      } catch (fileErr) {
                        console.error(`Failed to download attachment ${attachmentNode.name} for candidate ${candidateName}:`, fileErr);
                        enqueueSnackBar(`Error downloading ${attachmentNode.name}`, { variant: SnackBarVariant.Error });
                      }
                    }
                  }
                }
              } else {
                enqueueSnackBar(`No attachments found for ${candidateName}`, { variant: SnackBarVariant.Info, duration: 3000 });
              }
              resolve();
            },
          }).catch(reject);
        });
      }

      if (filesDownloaded > 0) {
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        saveAs(zipBlob, 'candidate_cvs.zip');
        enqueueSnackBar('CVs downloaded and zipped successfully!', {
          variant: SnackBarVariant.Success,
        });
        if (isDefined(onSuccess)) {
          onSuccess();
        }
      } else {
        enqueueSnackBar('No CV files found for the selected candidates.', {
          variant: SnackBarVariant.Warning,
          duration: 5000,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to download CVs`;
      const error = new Error(errorMessage);
      setError(error);
      enqueueSnackBar(errorMessage, {
        variant: SnackBarVariant.Error,
        duration: 5000,
      });
      if (isDefined(onError)) {
        onError(error);
      }
      console.error("Error in sendDownloadCVsRequest:", error);
    } finally {
      setLoading(false);
    }
  };

  return {
    sendDownloadCVsRequest,
    loading,
    error,
  };
};