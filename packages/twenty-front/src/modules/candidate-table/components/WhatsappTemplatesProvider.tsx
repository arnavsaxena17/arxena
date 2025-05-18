import { tokenPairState } from '@/auth/states/tokenPairState';
import axios from 'axios';
import { useEffect } from 'react';
import { useRecoilState } from 'recoil';
import { templatesState } from '../states/templatesState';

export const WhatsappTemplatesProvider = ({ children }: { children: React.ReactNode }) => {
  const [templates, setTemplates] = useRecoilState(templatesState);
  const [tokenPair] = useRecoilState(tokenPairState);

  useEffect(() => {
    const fetchAllTemplates = async () => {
      if (templates.templates.length > 0) return; // Don't fetch if we already have templates
      
      try {
        setTemplates(prev => ({ ...prev, isLoading: true }));
        const response = await axios.get(
          `${process.env.REACT_APP_SERVER_BASE_URL}/meta-whatsapp-controller/get-templates`,
          { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } },
        );

        const templateNames = response.data.templates
          .filter((template: { status: string }) => template.status === 'APPROVED')
          .map((template: { name: string }) => template.name);
        
        const previews: { [key: string]: string } = {};
        response.data.templates.forEach(
          (template: { components: any[]; name: string }) => {
            const bodyComponent = template.components.find(
              (comp) => comp.type === 'BODY'
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
        console.error('Error fetching templates:', error);
        setTemplates(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to load templates',
        }));
      }
    };

    if (tokenPair?.accessToken?.token) {
      fetchAllTemplates();
    }
  }, [tokenPair?.accessToken?.token]);

  return <>{children}</>;
}; 