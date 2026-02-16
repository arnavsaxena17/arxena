import { useRecoilState } from 'recoil';
import { templatesState } from '../states/templatesState';

// Define supported template names as a type for better type safety
export type SupportedTemplateName = 
  | 'recruitment'
  | 'application'
  | 'application02'
  | 'share_video_interview_link_direct_without_button'
  | 'share_video_interview_link_with_start_link'
  | 'share_video_interview_link_direct'
  | 'rejection_template'
  | 'follow_up';

// List of supported templates
export const SUPPORTED_TEMPLATES: SupportedTemplateName[] = [
  'recruitment',
  'application',
  'application02',
  'share_video_interview_link_direct_without_button',
  'share_video_interview_link_with_start_link',
  'share_video_interview_link_direct',
  'rejection_template',
  'follow_up',
];

// Template display names for UI
export const TEMPLATE_DISPLAY_NAMES: Record<SupportedTemplateName, string> = {
  'recruitment': 'Recruitment Message',
  'application': 'Application Message',
  'application02': 'Application Message (Alternative)',
  'share_video_interview_link_direct_without_button': 'Video Interview Link',
  'share_video_interview_link_with_start_link': 'Video Interview Link with Button',
  'share_video_interview_link_direct': 'Direct Video Interview Link',
  'rejection_template': 'Rejection Message',
  'follow_up': 'Follow-up Message',
};

export const useTemplates = () => {
  const [templates] = useRecoilState(templatesState);

  return {
    // Only return supported templates
    templates: templates.templates.filter(
      (template): template is SupportedTemplateName => 
        SUPPORTED_TEMPLATES.includes(template as SupportedTemplateName)
    ),
    // Only return previews for supported templates
    templatePreviews: Object.fromEntries(
      Object.entries(templates.templatePreviews)
        .filter(([key]) => SUPPORTED_TEMPLATES.includes(key as SupportedTemplateName))
    ),
    isLoading: templates.isLoading,
    error: templates.error,
    // Add helper functions
    isValidTemplate: (templateName: string): templateName is SupportedTemplateName => 
      SUPPORTED_TEMPLATES.includes(templateName as SupportedTemplateName),
    getDisplayName: (templateName: SupportedTemplateName) => 
      TEMPLATE_DISPLAY_NAMES[templateName] || templateName,
  };
}; 