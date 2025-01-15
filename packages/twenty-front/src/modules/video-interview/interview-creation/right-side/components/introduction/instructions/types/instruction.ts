export type Instruction = {
  id: string;
  element: (instructionNumber: number) => JSX.Element;
};
