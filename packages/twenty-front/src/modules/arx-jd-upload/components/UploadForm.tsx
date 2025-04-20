import { IconUpload } from 'twenty-ui';
import { StyledDropzoneArea } from './ArxJDUploadModal.styled';

type UploadFormProps = {
  getRootProps: any;
  getInputProps: any;
  isDragActive: boolean;
  isUploading: boolean;
  error: string | null;
  theme: any;
};

export const UploadForm = ({
  getRootProps,
  getInputProps,
  isDragActive,
  isUploading,
  error,
  theme,
}: UploadFormProps) => {
  const rootProps = getRootProps();
  const inputProps = getInputProps();

  // Prevent hotkey propagation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  return (
    <StyledDropzoneArea
      {...rootProps}
      onKeyDown={handleKeyDown}
    >
      <input
        {...inputProps}
        style={{ display: 'none' }}
        onKeyDown={handleKeyDown}
      />
      <IconUpload size={32} />
      {isDragActive ? (
        <p>Drop the JD file here...</p>
      ) : (
        <p>
          Drag & drop a JD file here, or click to select one
          <br />
          <small>Supported formats: PDF, DOC, DOCX (max 10MB)</small>
        </p>
      )}
      {isUploading && <p>Uploading and processing your file...</p>}
      {error && (
        <p
          style={{
            color: theme.color.red,
            marginTop: '8px',
            padding: '8px',
            backgroundColor: theme.background.danger,
            borderRadius: '4px',
            maxWidth: '80%',
            textAlign: 'center',
          }}
        >
          {error}
        </p>
      )}
    </StyledDropzoneArea>
  );
};
