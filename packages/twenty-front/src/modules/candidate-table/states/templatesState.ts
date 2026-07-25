import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

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

export const templatesState = createAtomState<TemplatesState>({
  key: 'templatesState',
  defaultValue: {
    templates: [],
    templatePreviews: {},
    isLoading: false,
    error: null,
  },
});
