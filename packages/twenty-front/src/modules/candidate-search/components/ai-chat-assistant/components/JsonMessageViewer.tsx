import styled from '@emotion/styled';
import { useCallback, useState } from 'react';

const StyledJsonContainer = styled.div`
  width: 100%;
  margin-top: ${({ theme }) => theme.spacing(1)};
`;

const StyledJsonHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.background.tertiary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  cursor: pointer;
  user-select: none;
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  
  &:hover {
    background-color: ${({ theme }) => theme.background.quaternary};
  }
`;

const StyledJsonContent = styled.pre<{ isExpanded: boolean }>`
  display: ${({ isExpanded }) => (isExpanded ? 'block' : 'none')};
  margin: 0;
  padding: ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.background.tertiary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  overflow-x: auto;
  font-size: ${({ theme }) => theme.font.size.xs};
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
  line-height: 1.5;
  color: ${({ theme }) => theme.font.color.primary};
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 500px;
  overflow-y: auto;
`;

const StyledJsonToggle = styled.span`
  margin-left: ${({ theme }) => theme.spacing(2)};
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
`;

const StyledJsonBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: ${({ theme }) => theme.spacing(0.5)} ${({ theme }) => theme.spacing(1)};
  background-color: ${({ theme }) => theme.color.blue10};
  color: ${({ theme }) => theme.color.blue};
  border-radius: ${({ theme }) => theme.border.radius.xs};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  margin-right: ${({ theme }) => theme.spacing(1)};
`;

type JsonMessageViewerProps = {
  content: string;
  label?: string;
};

/**
 * Attempts to parse and format JSON content
 * Handles JSON that might be embedded in text or have leading/trailing text
 */
const tryParseJson = (content: string): { parsed: any; isValid: boolean } => {
  const trimmed = content.trim();
  
  if (!trimmed) {
    return { parsed: null, isValid: false };
  }
  
  // Try to extract JSON from text if it's embedded
  let jsonString = trimmed;
  
  // Check if content starts with { or [ (likely JSON)
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    // Try to find complete JSON object/array by matching braces/brackets
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escapeNext = false;
    let jsonStart = -1;
    let jsonEnd = -1;
    
    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }
      
      if (inString) continue;
      
      if (char === '{') {
        if (jsonStart === -1) jsonStart = i;
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0 && jsonStart !== -1) {
          jsonEnd = i + 1;
          break;
        }
      } else if (char === '[') {
        if (jsonStart === -1) jsonStart = i;
        bracketCount++;
      } else if (char === ']') {
        bracketCount--;
        if (bracketCount === 0 && jsonStart !== -1 && braceCount === 0) {
          jsonEnd = i + 1;
          break;
        }
      }
    }
    
    if (jsonStart !== -1 && jsonEnd !== -1) {
      jsonString = trimmed.substring(jsonStart, jsonEnd);
    }
  } else {
    // Try to find JSON embedded in text (e.g., "message: {...}")
    const jsonMatch = trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      jsonString = jsonMatch[0];
    }
  }
  
  try {
    const parsed = JSON.parse(jsonString);
    return { parsed, isValid: true };
  } catch {
    // Not valid JSON
    return { parsed: null, isValid: false };
  }
};

/**
 * Formats JSON with syntax highlighting colors
 */
const formatJsonWithColors = (json: any, indent: number = 0): string => {
  if (json === null) return '<span style="color: #808080;">null</span>';
  if (json === undefined) return '<span style="color: #808080;">undefined</span>';
  
  if (typeof json === 'string') {
    return `<span style="color: #ce9178;">"${json.replace(/"/g, '&quot;')}"</span>`;
  }
  
  if (typeof json === 'number') {
    return `<span style="color: #b5cea8;">${json}</span>`;
  }
  
  if (typeof json === 'boolean') {
    return `<span style="color: #569cd6;">${json}</span>`;
  }
  
  if (Array.isArray(json)) {
    if (json.length === 0) return '[]';
    const items = json.map((item, index) => {
      const formatted = formatJsonWithColors(item, indent + 2);
      const comma = index < json.length - 1 ? ',' : '';
      return `${' '.repeat(indent + 2)}${formatted}${comma}`;
    }).join('\n');
    return `[\n${items}\n${' '.repeat(indent)}]`;
  }
  
  if (typeof json === 'object') {
    const keys = Object.keys(json);
    if (keys.length === 0) return '{}';
    const items = keys.map((key, index) => {
      const value = formatJsonWithColors(json[key], indent + 2);
      const comma = index < keys.length - 1 ? ',' : '';
      const keyStr = `<span style="color: #9cdcfe;">"${key}"</span>`;
      return `${' '.repeat(indent + 2)}${keyStr}: ${value}${comma}`;
    }).join('\n');
    return `{\n${items}\n${' '.repeat(indent)}}`;
  }
  
  return String(json);
};

export const JsonMessageViewer = ({ content, label = 'JSON' }: JsonMessageViewerProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { parsed, isValid } = tryParseJson(content);
  
  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);
  
  if (!isValid) {
    // Not valid JSON, return null to fall back to regular text display
    return null;
  }
  
  const formattedJson = JSON.stringify(parsed, null, 2);
  const jsonSize = formattedJson.length;
  const lineCount = formattedJson.split('\n').length;
  
  return (
    <StyledJsonContainer>
      <StyledJsonHeader onClick={toggleExpanded}>
        <div>
          <StyledJsonBadge>JSON</StyledJsonBadge>
          <span>
            {label} ({lineCount} lines, {jsonSize.toLocaleString()} chars)
          </span>
        </div>
        <StyledJsonToggle>
          {isExpanded ? '▼' : '▶'}
        </StyledJsonToggle>
      </StyledJsonHeader>
      <StyledJsonContent isExpanded={isExpanded}>
        {formattedJson}
      </StyledJsonContent>
    </StyledJsonContainer>
  );
};

