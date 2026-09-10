import {
  WORKFLOW_FORM_REGISTRY_NAMES,
  type WorkflowFormRegistryName,
  type WorkflowFormTemplateKind,
} from './workflow-form-template.registry';

// Kept for Meta inventory + ensure: outreach HITL + calendar slot/time + hosted fallback.
export const WORKFLOW_FORM_META_KEEP_TEMPLATE_NAMES = [
  WORKFLOW_FORM_REGISTRY_NAMES.BOOLEAN,
  WORKFLOW_FORM_REGISTRY_NAMES.BOOLEAN_TEXT,
  `${WORKFLOW_FORM_REGISTRY_NAMES.BOOLEAN_TEXT}_flow_v2`,
  `${WORKFLOW_FORM_REGISTRY_NAMES.BOOLEAN_TEXT}_flow_v4`,
  WORKFLOW_FORM_REGISTRY_NAMES.SELECT,
  `${WORKFLOW_FORM_REGISTRY_NAMES.SELECT}_flow_v2`,
  WORKFLOW_FORM_REGISTRY_NAMES.DATE,
  `${WORKFLOW_FORM_REGISTRY_NAMES.DATE}_flow_v2`,
  WORKFLOW_FORM_REGISTRY_NAMES.HOSTED,
] as const;

export const isWorkflowFormMetaKeepTemplateName = (
  name: string,
): boolean => {
  return (WORKFLOW_FORM_META_KEEP_TEMPLATE_NAMES as readonly string[]).includes(
    name,
  );
};

export type WorkflowFormRegistryPrunePlan = {
  keep: string[];
  delete: string[];
};

export const buildWorkflowFormMetaPrunePlan = (
  existingNames: string[],
): WorkflowFormRegistryPrunePlan => {
  const keep: string[] = [];
  const deleteNames: string[] = [];

  for (const name of existingNames) {
    if (!name.startsWith('wf_form')) {
      continue;
    }

    if (isWorkflowFormMetaKeepTemplateName(name)) {
      keep.push(name);
    } else {
      deleteNames.push(name);
    }
  }

  return {
    keep: keep.sort(),
    delete: deleteNames.sort(),
  };
};

export type { WorkflowFormRegistryName, WorkflowFormTemplateKind };
