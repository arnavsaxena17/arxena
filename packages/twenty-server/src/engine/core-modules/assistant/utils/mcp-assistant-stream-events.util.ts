import { StreamEventSender } from '../assistant.types';
import { extractTableRowsFromToolResult } from './mcp-assistant-table.util';

export const inferTableType = (
  toolName?: string,
  columns?: string[],
): string => {
  if (toolName) {
    if (toolName.includes('job')) return 'jobs';
    if (toolName.includes('compan')) return 'companies';
    if (toolName.includes('interview')) return 'interviews';
    if (toolName.includes('screen')) return 'screenings';
    if (
      toolName.includes('contact') ||
      toolName.includes('person') ||
      toolName.includes('people') ||
      toolName.includes('candidate')
    )
      return 'candidates';
  }
  if (columns) {
    const colSet = new Set(columns.map((c) => c.toLowerCase()));
    if (colSet.has('jobLocation') || colSet.has('joblocation')) return 'jobs';
    if (colSet.has('domain') || colSet.has('website')) return 'companies';
    if (
      colSet.has('headline') ||
      colSet.has('jobtitle') ||
      colSet.has('linkedinurl')
    )
      return 'candidates';
  }
  return 'data';
};

export const emitTableDataIfJson = (
  sendEvent: StreamEventSender,
  textContent: string,
  toolName?: string,
): void => {
  if (!textContent) return;
  try {
    const parsed = JSON.parse(textContent) as unknown;
    const rows = extractTableRowsFromToolResult(parsed);
    if (rows.length > 0) {
      const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      const tableType = inferTableType(toolName, columns);
      const tableId = crypto.randomUUID();
      const label = `${rows.length} ${tableType} result${rows.length !== 1 ? 's' : ''}`;
      sendEvent('table_data', { tableId, tableType, label, columns, rows });
    }
  } catch {
    // not JSON or not a list of objects – ignore
  }
};

export const emitStreamComplete = (
  sendEvent: StreamEventSender,
  fullText: string,
  allToolCalls: Array<{ name: string; args: Record<string, unknown> }>,
): void => {
  sendEvent('final_text', { text: fullText });
  sendEvent('done', {
    text: fullText,
    toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
  });
};
