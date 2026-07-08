export enum StepStatus {
  NOT_STARTED = 'NOT_STARTED',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  STOPPED = 'STOPPED',
  FAILED = 'FAILED',
  FAILED_SAFELY = 'FAILED_SAFELY',
  PENDING = 'PENDING',
  SKIPPED = 'SKIPPED',
}

export type WorkflowRunStepInfoHistoryEntry = {
  // NOTE: kept as `object` (not `unknown`) on purpose. In this codebase
  // `Relation<T> = T`, so relations fully expand in TypeORM's
  // `(Query)DeepPartialEntity`. An `unknown` leaf here would map to `{}` and
  // make every `.insert()`/`.save()` of any entity reaching WorkflowRun fail
  // to typecheck. Step results always come from `WorkflowActionOutput.result`
  // which is already `object`.
  result?: object;
  error?: string;
  status?: StepStatus;
};

export type WorkflowRunStepInfo = {
  status: StepStatus;
  result?: object;
  error?: string;
  history?: WorkflowRunStepInfoHistoryEntry[];
};

export type WorkflowRunStepInfos = Record<string, WorkflowRunStepInfo>;
