import {
  type File,
  SettingsLogicFunctionCodeEditor,
} from '@/settings/logic-functions/components/SettingsLogicFunctionCodeEditor';
import { SETTINGS_LOGIC_FUNCTION_TAB_LIST_COMPONENT_ID } from '@/settings/logic-functions/constants/SettingsLogicFunctionTabListComponentId';
import { TabList } from '@/ui/layout/tab-list/components/TabList';
import { activeTabIdComponentState } from '@/ui/layout/tab-list/states/activeTabIdComponentState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { Callout } from 'twenty-ui/feedback';
import { IconInfoCircle, IconPlayerPlay } from 'twenty-ui/icon';
import { H2Title } from 'twenty-ui/typography';
import { Button, CoreEditorHeader } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledTabListContainer = styled.div`
  > * {
    border-bottom: none;
  }
`;

const StyledCalloutWrapper = styled.div`
  margin-bottom: ${themeCssVariables.spacing[4]};
`;

export const SettingsLogicFunctionCodeEditorTab = ({
  files,
  handleExecute,
  onChange,
  isTesting = false,
  applicationVariableKeys,
  isNative = false,
}: {
  files: File[];
  handleExecute: () => void;
  onChange: (value: string) => void;
  isTesting?: boolean;
  applicationVariableKeys?: string[];
  isNative?: boolean;
}) => {
  const activeTabId = useAtomComponentStateValue(
    activeTabIdComponentState,
    SETTINGS_LOGIC_FUNCTION_TAB_LIST_COMPONENT_ID,
  );
  const TestButton = (
    <Button
      title={t`Test`}
      variant="primary"
      accent="blue"
      size="small"
      Icon={IconPlayerPlay}
      disabled={isTesting}
      onClick={handleExecute}
    />
  );

  const HeaderTabList = (
    <StyledTabListContainer>
      <TabList
        tabs={files.map((file) => {
          return { id: file.path, title: file.path.split('/').at(-1) || '' };
        })}
        componentInstanceId={SETTINGS_LOGIC_FUNCTION_TAB_LIST_COMPONENT_ID}
      />
    </StyledTabListContainer>
  );

  return (
    <Section>
      <H2Title
        title={isNative ? t`Function contract` : t`Code your function`}
        description={
          isNative
            ? t`This is the workflow input contract. The server runs the native implementation.`
            : t`Write your function (in typescript) below`
        }
      />
      {isNative && (
        <StyledCalloutWrapper>
          <Callout
            variant="info"
            Icon={IconInfoCircle}
            title={t`Native GTM action`}
            description={t`Editing this file does not change runtime behavior. Use Test or a workflow step to run Search / Fetch against the live APIs.`}
          />
        </StyledCalloutWrapper>
      )}
      <CoreEditorHeader leftNodes={[HeaderTabList]} rightNodes={[TestButton]} />
      {activeTabId && (
        <SettingsLogicFunctionCodeEditor
          files={files}
          currentFilePath={activeTabId}
          onChange={(newCodeValue: string) => onChange(newCodeValue)}
          applicationVariableKeys={applicationVariableKeys}
          readOnly={isNative}
        />
      )}
    </Section>
  );
};
