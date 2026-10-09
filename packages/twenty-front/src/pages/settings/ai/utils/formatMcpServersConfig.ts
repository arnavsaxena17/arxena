export type FormatMcpServersConfigResult =
  | { isValid: true; formattedText: string }
  | { isValid: false; errorMessage: string };

const getLineAndColumn = (
  text: string,
  position: number,
): { line: number; column: number } => {
  const textBeforeError = text.slice(0, position);
  const lines = textBeforeError.split('\n');

  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
};

export const formatMcpServersConfig = (
  rawText: string,
): FormatMcpServersConfigResult => {
  try {
    return {
      isValid: true,
      formattedText: JSON.stringify(JSON.parse(rawText), null, 2),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';
    const positionMatch = message.match(/position (\d+)/);

    if (positionMatch === null) {
      return { isValid: false, errorMessage: message };
    }

    const { line, column } = getLineAndColumn(
      rawText,
      Number(positionMatch[1]),
    );

    return {
      isValid: false,
      errorMessage: `Invalid JSON at line ${line}, column ${column}`,
    };
  }
};
