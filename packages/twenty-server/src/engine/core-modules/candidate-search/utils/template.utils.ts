/**
 * Replace template variables in prompt strings
 */
export function replaceTemplateVariables(template: string, variables: Record<string, any>): string {
  let result = template;
  
  // Replace {{variable}} patterns
  Object.keys(variables).forEach(key => {
    const value = variables[key];
    if (value !== undefined && value !== null) {
      // Properly serialize objects to JSON strings, otherwise use String conversion
      const stringValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), stringValue);
    }
  });

  // Replace {{#if variable}}...{{/if}} patterns
  result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, variable, content) => {
    return variables[variable] ? content : '';
  });

  return result;
}
