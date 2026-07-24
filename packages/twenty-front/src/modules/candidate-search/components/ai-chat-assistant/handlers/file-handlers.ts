import type { ParsedJD } from '@/arx-jd-upload/types/ParsedJD';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import type { ChatMessage } from '../types/chat-message.types';

type FileHandlerDeps = {
  parsedJD: ParsedJD;
  attachments: any[];
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => Promise<void>;
  enqueueSnackBar: (message: string, options: { variant: SnackBarVariant }) => void;
  setAttachments: (attachments: any[]) => void;
  setIsUploadingFile: (isUploading: boolean) => void;
  destroyOneRecord: (id: string) => Promise<any>;
  uploadAttachmentFile: (file: File, options: { targetObjectNameSingular: CoreObjectNameSingular; id: string }) => Promise<{ attachmentAbsoluteURL: string }>;
  findManyAttachments: (options: { filter: any; orderBy: any[] }) => Promise<any[]>;
  onJDRemove?: () => Promise<void>;
  onJDReplace?: (files: File[]) => Promise<void>;
  onJDUpload?: (file: File) => Promise<void>;
};

const removeExistingAttachments = async (
  attachments: any[],
  destroyOneRecord: (id: string) => Promise<any>
) => {
  try {
    // Delete all existing attachments
    for (const attachment of attachments) {
      if (attachment.id) {
        await destroyOneRecord(attachment.id);
      }
    }
  } catch (error) {
    console.error('Error removing existing attachments:', error);
  }
};

export const createJDRemoveHandler = (deps: FileHandlerDeps) => {
  return async () => {
    if (!deps.parsedJD?.id) return;
    
    try {
      deps.setIsUploadingFile(true);
      
      // Remove existing attachments
      await removeExistingAttachments(deps.attachments, deps.destroyOneRecord);
      
      // Refresh attachments list
      const fetchedAttachments = await deps.findManyAttachments({
        filter: { jobId: { eq: deps.parsedJD.id } },
        orderBy: [{ createdAt: 'DescNullsFirst' }],
      });
      deps.setAttachments(fetchedAttachments);
      
      await deps.addMessage({
        type: 'assistant',
        content: 'Job description file removed successfully. You can upload a new one using the replace button.',
      });
      
      deps.enqueueSnackBar('Job description file removed successfully', {
        variant: SnackBarVariant.Success,
      });
      
      if (deps.onJDRemove) {
        await deps.onJDRemove();
      }
    } catch (error) {
      console.error('Error removing JD file:', error);
      await deps.addMessage({
        type: 'assistant',
        content: 'Sorry, I encountered an error while removing the job description file.',
      });
      deps.enqueueSnackBar('Failed to remove job description file', {
        variant: SnackBarVariant.Error,
      });
    } finally {
      deps.setIsUploadingFile(false);
    }
  };
};

export const createJDReplaceHandler = (deps: FileHandlerDeps) => {
  return async (files: File[]) => {
    if (files.length === 0) return;
    
    const file = files[0];
    try {
      deps.setIsUploadingFile(true);
      
      await deps.addMessage({
        type: 'user',
        content: `Replacing JD with: ${file.name}`,
      });
      
      if (!deps.parsedJD?.id) {
        throw new Error('No job ID available for file upload');
      }
      
      // Remove existing attachments first
      await removeExistingAttachments(deps.attachments, deps.destroyOneRecord);
      
      // Upload new attachment
      const { attachmentAbsoluteURL } = await deps.uploadAttachmentFile(file, {
        targetObjectNameSingular: CoreObjectNameSingular.Job,
        id: deps.parsedJD.id,
      });
      
      // Refresh attachments list
      const fetchedAttachments = await deps.findManyAttachments({
        filter: { jobId: { eq: deps.parsedJD.id } },
        orderBy: [{ createdAt: 'DescNullsFirst' }],
      });
      deps.setAttachments(fetchedAttachments);
      
      await deps.addMessage({
        type: 'assistant',
        content: 'Job description file replaced successfully! I\'m analyzing the new file to update the search plan...',
      });
      
      deps.enqueueSnackBar('Job description file replaced successfully', {
        variant: SnackBarVariant.Success,
      });
      
      if (deps.onJDReplace) {
        await deps.onJDReplace(files);
      } else if (deps.onJDUpload) {
        await deps.onJDUpload(file);
      }
      
    } catch (error) {
      console.error('Error replacing JD file:', error);
      await deps.addMessage({
        type: 'assistant',
        content: 'Sorry, I encountered an error while replacing the job description file.',
      });
      deps.enqueueSnackBar('Failed to replace job description file', {
        variant: SnackBarVariant.Error,
      });
    } finally {
      deps.setIsUploadingFile(false);
    }
  };
};

