import { tokenPairState } from '@/auth/states/tokenPairState';
import axios from 'axios';
import { useEffect } from 'react';
import { templatesState } from '../states/templatesState';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

/**
 * Fetches WhatsApp templates only when mounted (e.g. when Candidate Chat drawer is open).
 * Placed around CandidateChatDrawer so we don't fetch on every app load.
 */
export const WhatsappTemplatesProvider = ({ children }: { children: React.ReactNode }) => {
  const [templates, setTemplates] = useAtomState(templatesState);
  const [tokenPair] = useAtomState(tokenPairState);

  useEffect(() => {
    if (!tokenPair?.accessOrWorkspaceAgnosticToken?.token) return;
    if (templates.templates.length > 0) return;

    const fetchAllTemplates = async () => {
      try {
        setTemplates((prev) => ({ ...prev, isLoading: true }));
        const response = await axios.get(
          `${REACT_APP_SERVER_BASE_URL}/meta-whatsapp-controller/get-templates`,
          { headers: { Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}` } },
        );

        const templateNames = response.data.templates
          .filter((template: { status: string }) => template.status === 'APPROVED')
          .map((template: { name: string }) => template.name);

        const previews: { [key: string]: string } = {};
        response.data.templates.forEach(
          (template: { components: any[]; name: string }) => {
            const bodyComponent = template.components.find(
              (comp) => comp.type === 'BODY',
            );
            if (bodyComponent) {
              previews[template.name] = bodyComponent.text;
            }
          },
        );

        setTemplates({
          templates: templateNames,
          templatePreviews: previews,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        setTemplates((prev) => ({
          ...prev,
          isLoading: false,
          error: 'Failed to load templates',
        }));
      }
    };

    fetchAllTemplates();
  }, [tokenPair?.accessOrWorkspaceAgnosticToken?.token]);

  return <>{children}</>;
}; 