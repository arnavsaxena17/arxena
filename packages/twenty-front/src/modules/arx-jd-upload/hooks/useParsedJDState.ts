import { projectIdAtom, projectsState } from '@/candidate-table/states/states';
import { useMemo } from 'react';

import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';

import {
  ProjectForParsedJDMerge,
  mergeParsedJDFromSources,
} from '../utils/mergeParsedJDFromSources';
import { ParsedJD } from '../types/ParsedJD';
import {
  arxUploadJDModalModeState,
  isArxUploadJDModalOpenState,
} from '../states/arxUploadJDModalOpenState';
import { parsedJDInternalState } from '../states/arxJDFormStepperState';

export const useParsedJDState = (): [
  ParsedJD | null,
  (value: ParsedJD | null | ((prev: ParsedJD | null) => ParsedJD | null)) => void,
] => {
  const userData = useAtomStateValue(parsedJDInternalState);
  const setUserData = useSetAtomState(parsedJDInternalState);
  const modalMode = useAtomStateValue(arxUploadJDModalModeState);
  const isModalOpen = useAtomStateValue(isArxUploadJDModalOpenState);
  const projectId = useAtomStateValue(projectIdAtom);
  const projects = useAtomStateValue(projectsState) as ProjectForParsedJDMerge[];

  const parsedJD = useMemo(
    () =>
      mergeParsedJDFromSources({
        projectId,
        projects,
        userData,
        modalMode,
        isModalOpen,
      }),
    [projectId, projects, userData, modalMode, isModalOpen],
  );

  const setParsedJD = (
    value: ParsedJD | null | ((prev: ParsedJD | null) => ParsedJD | null),
  ) => {
    if (typeof value === 'function') {
      const currentMerged = mergeParsedJDFromSources({
        projectId,
        projects,
        userData,
        modalMode,
        isModalOpen,
      });
      setUserData(value(currentMerged));
      return;
    }

    setUserData(value);
  };

  return [parsedJD, setParsedJD];
};

export const useParsedJDStateValue = (): ParsedJD | null => {
  const [parsedJD] = useParsedJDState();

  return parsedJD;
};

export const useSetParsedJDState = () => {
  const [, setParsedJD] = useParsedJDState();

  return setParsedJD;
};

export const useParsedJDInternalState = () =>
  useAtomState(parsedJDInternalState);

export const useSetParsedJDInternalState = () =>
  useSetAtomState(parsedJDInternalState);
