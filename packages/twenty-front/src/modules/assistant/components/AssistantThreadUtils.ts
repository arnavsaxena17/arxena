/** Show thread name without surrounding double quotes (LLM sometimes returns quoted names). */
export function displayThreadName(name: string): string {
  if (!name || typeof name !== 'string') return name ?? '';
  const trimmed = name.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

