import { WorkflowIfElseBranch } from '@/workflow/types/Workflow';
import { isDefined } from 'twenty-shared';

export const getBranchLabel = ({
  branchIndex,
  totalBranches,
  branch,
}: {
  branchIndex: number;
  totalBranches: number;
  branch: WorkflowIfElseBranch;
}): string => {
  if (!isDefined(branch.filterGroupId)) {
    return 'Else';
  }

  if (branchIndex === 0) {
    return 'If';
  }

  if (totalBranches > 1 && branchIndex < totalBranches - 1) {
    return 'Else if';
  }

  return 'If';
};
