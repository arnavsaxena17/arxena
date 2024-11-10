export type leftAndRightCombined = {
  id: string;
  leftQuestion: (questionNumber: number) => JSX.Element;
  rightQuestion: (questionNumber: number) => JSX.Element;
};
