import { EditableField, SeparatorDot } from "@/activities/chats/components/chat-window/ChatWindowStyles";


export const AdditionalInfoContent: React.FC<{
    messageCount: number;
    jobName: string;
    salary: string;
    city: string;
    candidateStatus: string;
    isEditingSalary: boolean;
    isEditingCity: boolean;
    isEditingCandidateStatus: boolean;
    onSalaryEdit: () => void;
    onCityEdit: () => void;
    onCandidateStatusEdit: () => void;
    onSalaryUpdate: () => void;
    onCityUpdate: () => void;
    onCandidateStatusUpdate: () => void;
    setSalary: (value: string) => void;
    setCity: (value: string) => void;
    setCandidateStatus: (value: string) => void;
  }> = ({
    messageCount,
    jobName,
    salary,
    city,
    candidateStatus,
    isEditingSalary,
    isEditingCity,
    isEditingCandidateStatus,
    onSalaryEdit,
    onCityEdit,
    onCandidateStatusEdit,
    onSalaryUpdate,
    onCityUpdate,
    onCandidateStatusUpdate,
    setSalary,
    setCity,
    setCandidateStatus,
  }) => (
    <>
      Messages: {messageCount}
      <SeparatorDot>•</SeparatorDot>
      Current Job: {jobName || 'N/A'}
      <SeparatorDot>•</SeparatorDot>
      <EditableField isEditing={isEditingSalary} onDoubleClick={onSalaryEdit}>
        {isEditingSalary ? (
          <input
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            onBlur={onSalaryUpdate}
            onKeyPress={(e) => e.key === 'Enter' && onSalaryUpdate()}
            autoFocus
          />
        ) : (
          `Salary: ${salary || 'N/A'}`
        )}
      </EditableField>
      <SeparatorDot>•</SeparatorDot>
      <EditableField isEditing={isEditingCity} onDoubleClick={onCityEdit}>
        {isEditingCity ? (
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onBlur={onCityUpdate}
            onKeyPress={(e) => e.key === 'Enter' && onCityUpdate()}
            autoFocus
          />
        ) : (
          `City: ${city || 'N/A'}`
        )}
      </EditableField>
      <SeparatorDot>•</SeparatorDot>
      <EditableField
        isEditing={isEditingCandidateStatus}
        onDoubleClick={onCandidateStatusEdit}
      >
        {isEditingCandidateStatus ? (
          <input
            value={candidateStatus}
            onChange={(e) => setCandidateStatus(e.target.value)}
            onBlur={onCandidateStatusUpdate}
            onKeyPress={(e) => e.key === 'Enter' && onCandidateStatusUpdate()}
            autoFocus
          />
        ) : (
          `Candidate Status: ${candidateStatus || 'N/A'}`
        )}
      </EditableField>
    </>
  );