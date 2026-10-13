// What the job-title taxonomy service says a title is. Only the function and
// the grade matter for deciding two titles are the same role.
export type TitleClass = {
  functionId: string;
  functionRoot: string | null;
  grade: string | null;
};
