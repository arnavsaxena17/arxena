import { CopyableField } from "@/activities/chats/components/chat-window/ChatWindowStyles";
import { CheckIcon, CopyIcon } from "@/activities/chats/components/chat-window/icons";
import { useState } from "react";


const CopyableFieldComponent: React.FC<{
    label: string;
    value: string;
    field: string;
    alwaysShowFull?: boolean;
  }> = ({ label, value, field, alwaysShowFull = false }) => {

    const [copiedField, setCopiedField] = useState(null);
    const copyToClipboard = (text: any, field: any) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };
    return (
    <CopyableField
      onClick={() => copyToClipboard(value, field)}
      title={copiedField === field ? 'Copied!' : 'Click to copy'}
    >
      {label}: {alwaysShowFull ? value : ``}
      {copiedField === field ? <CheckIcon /> : <CopyIcon />}
    </CopyableField>
    );
};

export default CopyableFieldComponent;