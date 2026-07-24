import { DropzoneRootProps, FileRejection } from 'react-dropzone';

export type DropzoneRenderProps = {
  getRootProps: <T extends HTMLElement = HTMLElement>(
    props?: Record<string, unknown>,
  ) => DropzoneRootProps;
  isDragActive: boolean;
  isDragAccept: boolean;
  isDragReject: boolean;
  isFileDialogActive: boolean;
  acceptedFiles: File[];
  fileRejections: FileRejection[];
};
