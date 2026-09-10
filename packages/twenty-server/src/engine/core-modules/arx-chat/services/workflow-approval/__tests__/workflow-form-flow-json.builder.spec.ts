import {
  FLOW_BOOLEAN_DECISION,
  FLOW_FIELD_KEY_BY_TYPE,
  buildWorkflowFormFlowJson,
  isModifyFlowBooleanValue,
  mapFlowBooleanValueToApprove,
  mapFlowResponseToFormFields,
} from '../workflow-form-flow-json.builder';

describe('workflow-form-flow-json.builder', () => {
  describe('buildWorkflowFormFlowJson', () => {
    it('should build Yes/No/Modify with conditional text for BOOLEAN+TEXT', () => {
      const flowJson = buildWorkflowFormFlowJson(['BOOLEAN', 'TEXT']);
      const screen = (
        flowJson.screens as Array<{
          layout: { children: Array<Record<string, unknown>> };
        }>
      )[0];
      const children = screen.layout.children;
      const form = children.find((child) => child.type === 'Form') as {
        children: Array<Record<string, unknown>>;
      };
      const radio = form.children.find(
        (child) => child.type === 'RadioButtonsGroup',
      );
      const conditional = form.children.find(
        (child) => child.type === 'Switch',
      ) as {
        value: string;
        cases: Record<string, Array<Record<string, unknown>>>;
      };

      expect(radio?.['data-source']).toEqual([
        { id: FLOW_BOOLEAN_DECISION.YES, title: 'Yes' },
        { id: FLOW_BOOLEAN_DECISION.NO, title: 'No' },
        { id: FLOW_BOOLEAN_DECISION.MODIFY, title: 'Modify' },
      ]);
      expect(conditional.value).toBe(
        `\${form.${FLOW_FIELD_KEY_BY_TYPE.BOOLEAN}}`,
      );
      expect(conditional.cases[FLOW_BOOLEAN_DECISION.MODIFY]).toEqual([
        expect.objectContaining({
          type: 'TextArea',
          name: FLOW_FIELD_KEY_BY_TYPE.TEXT,
          required: true,
        }),
      ]);
    });

    it('should keep a plain text area for TEXT-only flows', () => {
      const flowJson = buildWorkflowFormFlowJson(['TEXT']);
      const screen = (
        flowJson.screens as Array<{
          layout: { children: Array<Record<string, unknown>> };
        }>
      )[0];
      const children = screen.layout.children;

      expect(children.some((child) => child.type === 'If')).toBe(false);
      expect(
        children.some(
          (child) =>
            child.type === 'TextArea' &&
            child.name === FLOW_FIELD_KEY_BY_TYPE.TEXT,
        ),
      ).toBe(true);
    });
  });

  describe('mapFlowResponseToFormFields', () => {
    const formSnapshot = [
      { name: 'approve', type: 'BOOLEAN', value: true },
      {
        name: 'editedBody',
        type: 'TEXT',
        value: 'Original draft message',
      },
    ];

    it('should approve Yes with the draft text when the text box is hidden', () => {
      const result = mapFlowResponseToFormFields(
        {
          [FLOW_FIELD_KEY_BY_TYPE.BOOLEAN]: FLOW_BOOLEAN_DECISION.YES,
        },
        formSnapshot,
      );

      expect(result).toEqual({
        approve: true,
        editedBody: 'Original draft message',
      });
    });

    it('should reject No', () => {
      const result = mapFlowResponseToFormFields(
        {
          [FLOW_FIELD_KEY_BY_TYPE.BOOLEAN]: FLOW_BOOLEAN_DECISION.NO,
        },
        formSnapshot,
      );

      expect(result.approve).toBe(false);
      expect(result.editedBody).toBeUndefined();
    });

    it('should approve Modify with the edited text', () => {
      const result = mapFlowResponseToFormFields(
        {
          [FLOW_FIELD_KEY_BY_TYPE.BOOLEAN]: FLOW_BOOLEAN_DECISION.MODIFY,
          [FLOW_FIELD_KEY_BY_TYPE.TEXT]: '  Edited outbound copy  ',
        },
        formSnapshot,
      );

      expect(result).toEqual({
        approve: true,
        editedBody: 'Edited outbound copy',
      });
    });
  });

  describe('boolean helpers', () => {
    it('should map yes/modify to approve and no to reject', () => {
      expect(mapFlowBooleanValueToApprove(FLOW_BOOLEAN_DECISION.YES)).toBe(
        true,
      );
      expect(mapFlowBooleanValueToApprove(FLOW_BOOLEAN_DECISION.MODIFY)).toBe(
        true,
      );
      expect(mapFlowBooleanValueToApprove(FLOW_BOOLEAN_DECISION.NO)).toBe(
        false,
      );
      expect(isModifyFlowBooleanValue(FLOW_BOOLEAN_DECISION.MODIFY)).toBe(true);
      expect(isModifyFlowBooleanValue(FLOW_BOOLEAN_DECISION.YES)).toBe(false);
    });
  });
});
