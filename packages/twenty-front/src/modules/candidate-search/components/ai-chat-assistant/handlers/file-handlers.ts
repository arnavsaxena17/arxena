import type { SnackBarEnqueueFunctions } from '@/candidate-search/types/snackbar.types';
import type { ParsedJD } from '@/arx-jd-upload/types/ParsedJD';
import type { ChatMessage } from '../types/chat-message.types';

type FileHandlerDeps = {
  parsedJD: ParsedJD;
  attachments: any[];
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => Promise<void>;
  snackBars: SnackBarEnqueueFunctions;
  setAttachments: (attachments: any[]) => void;
  setIsUploadingFile: (isUploading: boolean) => void;
  destroyOneRecord: (id: string) => Promise<any>;
  uploadAttachmentFile: (
    file: File,
    options: { targetObjectNameSingular: string; id: string },
  ) => Promise<{ attachmentAbsoluteURL: string }>;
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
        filter: { targetProjectId: { eq: deps.parsedJD.id } },
        orderBy: [{ createdAt: 'DescNullsFirst' }],
      });
      deps.setAttachments(fetchedAttachments);
      
      await deps.addMessage({
        type: 'assistant',
        content: 'Project description file removed successfully. You can upload a new one using the replace button.',
      });
      
      deps.snackBars.enqueueSuccessSnackBar({ message: 'Project description file removed successfully' });
      
      if (deps.onJDRemove) {
        await deps.onJDRemove();
      }
    } catch (error) {
      console.error('Error removing JD file:', error);
      await deps.addMessage({
        type: 'assistant',
        content: 'Sorry, I encountered an error while removing the job description file.',
      });
      deps.snackBars.enqueueErrorSnackBar({ message: 'Failed to remove job description file' });
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
        targetObjectNameSingular: 'project',
        id: deps.parsedJD.id,
      });
      
      // Refresh attachments list
      const fetchedAttachments = await deps.findManyAttachments({
        filter: { targetProjectId: { eq: deps.parsedJD.id } },
        orderBy: [{ createdAt: 'DescNullsFirst' }],
      });
      deps.setAttachments(fetchedAttachments);
      
      await deps.addMessage({
        type: 'assistant',
        content: 'Project description file replaced successfully! I\'m analyzing the new file to update the search plan...',
      });
      
      deps.snackBars.enqueueSuccessSnackBar({ message: 'Project description file replaced successfully' });
      
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
      deps.snackBars.enqueueErrorSnackBar({ message: 'Failed to replace job description file' });
    } finally {
      deps.setIsUploadingFile(false);
    }
  };
};

