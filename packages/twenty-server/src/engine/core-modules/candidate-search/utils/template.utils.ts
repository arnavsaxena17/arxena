/**
 * Replace template variables in prompt strings
 */
export function replaceTemplateVariables(template: string, variables: Record<string, any>): string {
  let result = template;
  
  // Replace {{variable}} patterns
  Object.keys(variables).forEach(key => {
    const value = variables[key];
    if (value !== undefined && value !== null) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
  });

  // Replace {{#if variable}}...{{/if}} patterns
  result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, variable, content) => {
    return variables[variable] ? content : '';
  });

  return result;
}
