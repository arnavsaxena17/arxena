import { atom } from 'recoil';

export type Template = {
  name: string;
  status: string;
  components: {
    type: string;
    text: string;
  }[];
};

export type TemplatesState = {
  templates: string[];
  templatePreviews: { [key: string]: string };
  isLoading: boolean;
  error: string | null;
};

export const templatesState = atom<TemplatesState>({
  key: 'templatesState',
  default: {
    templates: [],
    templatePreviews: {},
    isLoading: false,
    error: null,
  },
}); 