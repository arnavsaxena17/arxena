import { v4 } from 'uuid';

import { type ToolProgressStreamEmitter } from 'src/engine/core-modules/tool-provider/interfaces/tool-progress-stream-emitter.type';
import { type CompanyOutcome } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-by-company.types';

const PROGRESS_HEARTBEAT_MS = 5_000;
const MAX_PROGRESS_LOGS = 6;
const MAX_NAMED_IN_FLIGHT = 3;

export type FindPeopleProgressReporter = {
  companyStarted: (company: string) => void;
  companyFinished: (company: string, outcome: CompanyOutcome) => void;
  finish: (state: 'completed' | 'error', message?: string) => void;
};

const NO_PROGRESS: FindPeopleProgressReporter = {
  companyStarted: () => undefined,
  companyFinished: () => undefined,
  finish: () => undefined,
};

const describeOutcome = (outcome: CompanyOutcome): string => {
  const roleStates = outcome.roleStates ?? [];
  const found = roleStates.filter((state) => state.terminalState === 'found');
  const people = outcome.people.length;

  if (roleStates.length === 0) {
    return `${outcome.company}: ${people} ${people === 1 ? 'person' : 'people'}`;
  }

  return `${outcome.company}: ${people} ${people === 1 ? 'person' : 'people'}, ${found.length} of ${roleStates.length} roles filled`;
};

// A find_people_by_company call runs for minutes; without this the chat shows
// only the tool name. It says how many companies are done, who was found, and
// which companies are still being searched, every few seconds.
export const createFindPeopleProgressReporter = ({
  onToolProgress,
  companyCount,
  roleCount,
}: {
  onToolProgress?: ToolProgressStreamEmitter;
  companyCount: number;
  roleCount: number;
}): FindPeopleProgressReporter => {
  if (onToolProgress === undefined) {
    return NO_PROGRESS;
  }

  const progressId = v4();
  const startedAt = Date.now();
  const inFlight = new Set<string>();
  const logs: string[] = [];
  let done = 0;
  let peopleFound = 0;
  let spentUsd = 0;
  let finished = false;

  const log = (line: string) => {
    logs.push(line);
    logs.splice(0, Math.max(0, logs.length - MAX_PROGRESS_LOGS));
  };
  const summary = (): string => {
    const searching = [...inFlight];
    const named = searching.slice(0, MAX_NAMED_IN_FLIGHT).join(', ');
    const more =
      searching.length > MAX_NAMED_IN_FLIGHT
        ? ` +${searching.length - MAX_NAMED_IN_FLIGHT} more`
        : '';

    return [
      `${done} of ${companyCount} companies done`,
      `${peopleFound} ${peopleFound === 1 ? 'person' : 'people'} found`,
      ...(spentUsd > 0 ? [`$${spentUsd.toFixed(2)}`] : []),
      ...(searching.length > 0 ? [`searching ${named}${more}`] : []),
      `${Math.round((Date.now() - startedAt) / 1000)}s`,
    ].join(' · ');
  };
  const emit = (state: 'running' | 'completed' | 'error', message: string) =>
    onToolProgress({
      progressId,
      toolName: 'find_people_by_company',
      state,
      message,
      current: done,
      total: companyCount,
      elapsedMs: Date.now() - startedAt,
      logs: [...logs],
    });

  emit(
    'running',
    `Looking up ${companyCount} ${companyCount === 1 ? 'company' : 'companies'} × ${roleCount} ${roleCount === 1 ? 'role' : 'roles'}`,
  );

  // Sources can take a minute on one company with nothing new to report; the
  // heartbeat keeps the elapsed time and the in-flight companies moving
  const heartbeat = setInterval(
    () => emit('running', summary()),
    PROGRESS_HEARTBEAT_MS,
  );

  return {
    companyStarted: (company) => {
      inFlight.add(company);
      emit('running', summary());
    },
    companyFinished: (company, outcome) => {
      inFlight.delete(company);
      done += 1;
      peopleFound += outcome.people.length;
      spentUsd += outcome.spentUsd;
      log(describeOutcome(outcome));
      emit('running', summary());
    },
    finish: (state, message) => {
      if (finished) {
        return;
      }

      finished = true;
      clearInterval(heartbeat);
      inFlight.clear();
      emit(state, message ?? summary());
    },
  };
};
