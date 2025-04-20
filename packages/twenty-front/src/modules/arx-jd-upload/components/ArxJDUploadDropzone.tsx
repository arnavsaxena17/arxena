import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ReactNode } from 'react';
import Dropzone, {
  DropzoneRootProps,
  FileRejection,
  useDropzone,
} from 'react-dropzone';

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

type ArxJDUploadDropzoneProps = {
  onDrop: (acceptedFiles: File[]) => Promise<void>;
  children: (props: {
    getRootProps: ReturnType<typeof useDropzone>['getRootProps'];
    getInputProps: ReturnType<typeof useDropzone>['getInputProps'];
    isDragActive: boolean;
  }) => ReactNode;
};

export const ArxJDUploadDropzone = ({
  onDrop,
  children,
}: ArxJDUploadDropzoneProps) => {
  const { enqueueSnackBar } = useSnackBar();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        ['.docx'],
    },
    multiple: false,
    validator: (file: File | DataTransferItem) => {
      // Handle both File and DataTransferItem objects
      const fileName =
        'name' in file
          ? file.name
          : (file as DataTransferItem).getAsFile()?.name;

      if (!fileName) {
        // enqueueSnackBar(
        //   `Multiple dots (.) in your file name. Remove . from file name and try again.`,
        //   {
        //     variant: SnackBarVariant.Error
        //   },
        // );

        return {
          code: 'invalid-file',
          message: 'Invalid file format',
        };
      }

      const dotCount = fileName.split('.').length - 1;
      if (dotCount > 1) {
        enqueueSnackBar(
          `Multiple dots (.) in your file name. Remove . from file name and try again.`,
          {
            variant: SnackBarVariant.Error,
          },
        );
        return {
          code: 'multiple-dots',
          message:
            'Please remove additional dots from the file name and try again',
        };
      }
      return null;
    },
  });

  return (
    <>
      {children({ getRootProps, getInputProps, isDragActive })}
      <Dropzone
        multiple={false}
        onDrop={onDrop}
        accept={{
          'application/pdf': ['.pdf'],
          'text/plain': ['.txt'],
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            ['.docx'],
        }}
        validator={(file: File | DataTransferItem) => {
          const fileName =
            'name' in file
              ? file.name
              : (file as DataTransferItem).getAsFile()?.name;

          if (!fileName) {
            return {
              code: 'invalid-file',
              message: 'Invalid file format',
            };
          }

          const dotCount = fileName.split('.').length - 1;
          if (dotCount > 1) {
            return {
              code: 'multiple-dots',
              message:
                'Please remove additional dots from the file name and try again',
            };
          }
          return null;
        }}
      >
        {(props: DropzoneRenderProps) => {
          const { getRootProps, isDragActive } = props;

          // Add handlers for all mouse events to prevent propagation
          const modalProps = getRootProps({
            onDragEnter: (e: React.DragEvent<HTMLElement>) =>
              e.stopPropagation(),
            onDragOver: (e: React.DragEvent<HTMLElement>) =>
              e.stopPropagation(),
            onDragLeave: (e: React.DragEvent<HTMLElement>) =>
              e.stopPropagation(),
            onDrop: (e: React.DragEvent<HTMLElement>) => {
              e.stopPropagation();
            },
          });

          const modalStyle: React.CSSProperties = {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: isDragActive ? 1 : -1,
          };

          return (
            <div
              role="presentation"
              onKeyDown={(e) => {
                modalProps.onKeyDown && modalProps.onKeyDown(e);
                e.stopPropagation();
              }}
              onFocus={modalProps.onFocus}
              onBlur={modalProps.onBlur}
              onDragEnter={(e) => {
                modalProps.onDragEnter && modalProps.onDragEnter(e);
                e.stopPropagation();
              }}
              onDragOver={(e) => {
                modalProps.onDragOver && modalProps.onDragOver(e);
                e.stopPropagation();
              }}
              onDragLeave={(e) => {
                modalProps.onDragLeave && modalProps.onDragLeave(e);
                e.stopPropagation();
              }}
              onDrop={(e) => {
                modalProps.onDrop && modalProps.onDrop(e);
                e.stopPropagation();
              }}
              tabIndex={modalProps.tabIndex}
              style={modalStyle}
            />
          );
        }}
      </Dropzone>
    </>
  );
};
