import { McpTool } from '../types/tool-types';
import { getToolMetadata } from './tool-metadata';

export const formatToolDefinitionForMcp = (
  tool: McpTool,
): McpTool['definition'] & {
  title: string;
  annotations: ReturnType<typeof getToolMetadata>['annotations'];
} => {
  const metadata = getToolMetadata(tool.definition.name);
  const explicit = tool.definition;

  return {
    ...explicit,
    title: explicit.title ?? metadata.title,
    annotations: explicit.annotations ?? metadata.annotations,
  };
};
