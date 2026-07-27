import { tokenPairState } from '@/auth/states/tokenPairState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import axios from 'axios';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { useCallback, useState } from 'react';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
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
  const tokenPair = useAtomStateValue(tokenPairState);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar, enqueueWarningSnackBar, enqueueInfoSnackBar } = useSnackBar();

  const { findOneRecord: findOneCandidateRecord } = useLazyFindOneRecord<any>({
    objectNameSingular: 'candidate',
    fetchPolicy: 'network-only',
  });

  const resetState = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  const sendDownloadCVsRequest = useCallback(async (candidateIds: string[]) => {
    if (!candidateIds || candidateIds.length === 0) {
      enqueueWarningSnackBar({ message: 'No candidates selected for CV download.', options: { duration: 3000 } });
      return;
    }

    if (loading) {
      enqueueWarningSnackBar({ message: 'A download is already in progress.', options: { duration: 3000 } });
      return;
    }

    setLoading(true);
    setError(null);
    const zip = new JSZip();
    let filesDownloaded = 0;

    try {
      for (const candidateId of candidateIds) {
        try {
          await new Promise<void>((resolve, reject) => {
            findOneCandidateRecord({
              objectRecordId: candidateId,
              onCompleted: async (candidateData) => {
                try {
                  if (!candidateData) {
                    console.warn(`No data found for candidate ID: ${candidateId}`);
                    resolve();
                    return;
                  }

                  const candidateName = candidateData.name || candidateId;
                  const sanitizedCandidateName = candidateName.replace(/[^a-zA-Z0-9_\\-\\/]/g, '_');
                  const attachments = candidateData.attachments;

                  if (attachments && attachments.length > 0) {
                    console.log('attachments:::', attachments);
                    for (const attachmentNode of attachments) {
                      console.log('attachmentNode:::', attachmentNode);
                      if (attachmentNode && attachmentNode.fullPath && attachmentNode.name) {
                        console.log('attachmentNode.type:::', attachmentNode.type);
                        if (attachmentNode.type === 'TextDocument' || attachmentNode.name.match(/\\.(pdf|doc|docx)$/i)) {
                          console.log('attachmentNode.fullPath:::', attachmentNode.fullPath);
                          try {
                            const fileResponse = await axios.get(attachmentNode.fullPath, {
                              responseType: 'arraybuffer',
                              headers: { Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}` }
                            });
                            console.log('fileResponse:::', fileResponse);
                            const uniqueFileName = `${attachmentNode.name}`;
                            zip.file(uniqueFileName, fileResponse.data, { binary: true });
                            filesDownloaded++;
                          } catch (fileErr) {
                            console.error(`Failed to download attachment ${attachmentNode.name} for candidate ${candidateName}:`, fileErr);
                            enqueueErrorSnackBar({ message: `Error downloading ${attachmentNode.name}` });
                          }
                        }
                      }
                    }
                  } else {
                    enqueueInfoSnackBar({ message: `No attachments found for ${candidateName}`, options: { duration: 3000 } });
                  }
                  resolve();
                } catch (err) {
                  console.error('Error processing candidate data:', err);
                  reject(err);
                }
              },
            }).catch(reject);
          });
        } catch (candidateErr) {
          console.error(`Error processing candidate ${candidateId}:`, candidateErr);
          enqueueErrorSnackBar({ message: `Error processing candidate ${candidateId}` });
          // Continue with next candidate
          continue;
        }
      }

      if (filesDownloaded > 0) {
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        saveAs(zipBlob, 'candidate_cvs.zip');
        enqueueSuccessSnackBar({ message: 'CVs downloaded and zipped successfully!' });
        if (isDefined(onSuccess)) {
          onSuccess();
        }
      } else {
        enqueueWarningSnackBar({ message: 'No CV files found for the selected candidates.', options: { duration: 5000 } });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to download CVs`;
      const error = new Error(errorMessage);
      setError(error);
      enqueueErrorSnackBar({ message: errorMessage, options: { duration: 5000 } });
      if (isDefined(onError)) {
        onError(error);
      }
      console.error("Error in sendDownloadCVsRequest:", error);
    } finally {
      setLoading(false);
    }
  }, [findOneCandidateRecord, loading, tokenPair?.accessOrWorkspaceAgnosticToken?.token, enqueueSuccessSnackBar, onSuccess, onError]);

  return {
    sendDownloadCVsRequest,
    loading,
    error,
    resetState,
    isLoading: loading,
  };
};