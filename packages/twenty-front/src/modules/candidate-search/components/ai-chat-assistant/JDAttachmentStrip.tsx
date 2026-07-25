import { IconFile } from 'twenty-ui/icon';
import { ParsedJD } from '@/arx-jd-upload/types/ParsedJD';
import { useFindManyAttachments } from '@/candidate-search/hooks/useFindManyAttachments';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useEffect, useState } from 'react';

const StyledAttachmentStrip = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  font-size: ${themeCssVariables.font.size.sm};
  flex-shrink: 0;
`;

const StyledFileInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  flex: 1;
`;

const StyledFileName = styled.span`
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.font.color.primary};
`;

type JDAttachmentStripProps = {
  parsedJD: ParsedJD | null;
  onFileRemove?: () => Promise<void>;
  onFileUpload?: (files: File[]) => Promise<void>;
  isUploading?: boolean;
  onParsedJDUpdate?: (updatedParsedJD: ParsedJD) => void;
};

export const JDAttachmentStrip = ({
  parsedJD,
}: JDAttachmentStripProps) => {
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);

  const { findManyAttachments } = useFindManyAttachments();

  // Fetch attachments for the current job using parsedJD.id
  useEffect(() => {
    const fetchAttachments = async () => {
      if (!parsedJD?.id) {
        setAttachments([]);
        return;
      }

      try {
        setIsLoadingAttachments(true);
        const fetchedAttachments = await findManyAttachments({
          filter: { projectId: { eq: parsedJD.id } },
          orderBy: [{ createdAt: 'DescNullsFirst' }],
          limit: 1,
        });
        setAttachments(fetchedAttachments);
      } catch (error) {
        console.error('Error fetching attachments:', error);
        setAttachments([]);
      } finally {
        setIsLoadingAttachments(false);
      }
    };

    fetchAttachments();
  }, [parsedJD?.id, findManyAttachments]);

  const getFileName = () => {
    // First priority: use actual attachment name if available
    if (attachments && attachments.length > 0 && attachments[0]?.name) {
      return attachments[0].name;
    }
    
    // Fallback to parsedJD name if available
    if (parsedJD && parsedJD.name && parsedJD.name.trim() !== '') {
      const jobCode = parsedJD.jobCode ? `${parsedJD.jobCode} - ` : '';
      return `${jobCode}${parsedJD.name}.pdf`;
    }
    
    // Final fallback: show generic name
    return 'Project Description';
  };

  const fileName = getFileName();
  const hasFile = attachments && attachments.length > 0;

  // Don't render if no parsedJD or job ID is available
  if (!parsedJD || !parsedJD.id) {
    return null;
  }

  // Show loading state while fetching attachments
  if (isLoadingAttachments) {
    return (
      <StyledAttachmentStrip>
        <StyledFileInfo>
          <IconFile size={16} />
          <StyledFileName>Loading JD attachment...</StyledFileName>
        </StyledFileInfo>
      </StyledAttachmentStrip>
    );
  }
  
  return (
    <StyledAttachmentStrip>
      <StyledFileInfo>
        <IconFile size={16} />
        <StyledFileName>
          {hasFile
            ? fileName.length > 40
              ? `${fileName.substring(0, 37)}...`
              : fileName
            : `${(parsedJD?.name?.length ?? 0) > 40
                ? `${parsedJD?.name.substring(0, 37)}...` 
                : parsedJD?.name || 'Project Description'
              } (No file attached)`}
        </StyledFileName>
      </StyledFileInfo>
    </StyledAttachmentStrip>
  );
};
