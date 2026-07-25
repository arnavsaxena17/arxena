import type { ReactElement } from 'react';

export type Instruction = {
  id: string;
  element: (instructionNumber: number) => ReactElement;
};
