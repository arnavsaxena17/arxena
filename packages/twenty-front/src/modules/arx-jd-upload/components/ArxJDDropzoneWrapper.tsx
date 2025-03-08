import { ReactNode } from 'react';
import Dropzone, { DropzoneState, useDropzone } from 'react-dropzone';

type ArxJDDropzoneWrapperProps = {
  onDrop: (acceptedFiles: File[]) => void;
  children: ReactNode;
  renderDropzoneContent: (props: DropzoneState) => React.ReactElement;
};

export const ArxJDDropzoneWrapper = ({
  onDrop,
  children,
  renderDropzoneContent,
}: ArxJDDropzoneWrapperProps) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        ['.docx'],
    },
    multiple: false,
  });

  return (
    <>
      {children}
      <Dropzone
        noClick={true}
        multiple={false}
        onDrop={onDrop}
        accept={{
          'application/pdf': ['.pdf'],
          'text/plain': ['.txt'],
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            ['.docx'],
        }}
      >
        {renderDropzoneContent}
      </Dropzone>
    </>
  );
};
