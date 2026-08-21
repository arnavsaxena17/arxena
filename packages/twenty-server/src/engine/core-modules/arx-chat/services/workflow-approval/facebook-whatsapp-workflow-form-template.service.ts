import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosRequestConfig } from 'axios';

import { FacebookWhatsappWorkflowFormFlowService } from './facebook-whatsapp-workflow-form-flow.service';
import {
  getFlowNameForRegistry,
  getFlowTemplateNameForRegistry,
} from './workflow-form-flow-json.builder';
import { buildWorkflowFormQuickReplyPayload } from './workflow-form-decision-pointer.util';
import {
  buildWorkflowApprovalFillPath,
  WORKFLOW_FORM_TEMPLATE_REGISTRY,
  type WorkflowFormRegistryEntry,
  type WorkflowFormRegistryName,
  type WorkflowFormTemplateKind,
} from './workflow-form-template.registry';

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export type FacebookWhatsappCredentials = {
  apiToken: string;
  phoneNumberId: string;
  assetId: string;
  appId: string | undefined;
  serverBaseUrl: string;
};

export type EnsureRegistryTemplateResult = {
  name: string;
  templateKind: WorkflowFormTemplateKind | 'flow_button';
  status: 'exists' | 'created' | 'error' | 'skipped';
  templateId?: string;
  templateStatus?: string;
  error?: string;
};

export type SendWorkflowFormTemplateInput = {
  to: string;
  registryName: WorkflowFormRegistryName | string;
  contextText: string;
  detailsText?: string;
  token: string;
  formFields?: Array<{
    name: string;
    type: string;
    label?: string;
    placeholder?: string;
    value?: unknown;
    settings?: Record<string, unknown>;
  }>;
};

type FlowOption = { id: string; title: string };

// Meta rejects body text that starts/ends with a variable; keep static wrappers
const BOOLEAN_QR_BODY_TEXT =
  'Arxena workflow form needs your decision.\n\nBackdrop: {{1}}\n\nDetails: {{2}}\n\nPlease respond Yes or No.';
const HOSTED_URL_BODY_TEXT =
  'Arxena workflow form needs your input.\n\nBackdrop: {{1}}\n\nDetails: {{2}}\n\nOpen the form to fill the fields.';
const FLOW_BODY_TEXT =
  'Arxena workflow form needs your input.\n\nBackdrop: {{1}}\n\nDetails: {{2}}\n\nTap Open form to answer in WhatsApp.';

const BODY_EXAMPLE = [
  [
    'Approve outreach to Acme Corp CEO',
    'Company: Acme Corp | Contact: Jane Doe | Channel: LinkedIn',
  ],
];

const sanitizeWhatsappTemplateParam = (
  value: string,
  maxLength = 800,
): string => {
  const normalized = value.replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return '-';
  }

  return normalized.slice(0, maxLength);
};

@Injectable()
export class FacebookWhatsappWorkflowFormTemplateService {
  private readonly logger = new Logger(
    FacebookWhatsappWorkflowFormTemplateService.name,
  );

  constructor(
    private readonly facebookWhatsappWorkflowFormFlowService: FacebookWhatsappWorkflowFormFlowService,
  ) {}

  getCredentials(): FacebookWhatsappCredentials {
    const apiToken = process.env.FACEBOOK_WHATSAPP_API_TOKEN?.trim();
    const phoneNumberId =
      process.env.FACEBOOK_WHATSAPP_PHONE_NUMBER_ID?.trim();
    const assetId = process.env.FACEBOOK_WHATSAPP_ASSET_ID?.trim();
    const appId = process.env.FACEBOOK_WHATSAPP_APP_ID?.trim();
    const serverBaseUrl = (
      process.env.SERVER_BASE_URL ?? 'http://localhost:3000'
    ).replace(/\/$/, '');

    if (!apiToken || !phoneNumberId || !assetId) {
      throw new Error(
        'Missing FACEBOOK_WHATSAPP_API_TOKEN, FACEBOOK_WHATSAPP_PHONE_NUMBER_ID, or FACEBOOK_WHATSAPP_ASSET_ID',
      );
    }

    return {
      apiToken,
      phoneNumberId,
      assetId,
      appId: appId || undefined,
      serverBaseUrl,
    };
  }

  private getAuthHeaders(
    credentials: FacebookWhatsappCredentials,
  ): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${credentials.apiToken}`,
    };
  }

  async listMessageTemplates(): Promise<unknown[]> {
    const credentials = this.getCredentials();
    const templates: unknown[] = [];
    let nextPageUrl: string | null =
      `${GRAPH_API_BASE}/${credentials.assetId}/message_templates`;

    while (nextPageUrl) {
      const response: {
        data?: {
          data?: unknown[];
          paging?: { next?: string };
        };
      } = await axios.get(nextPageUrl, {
        headers: this.getAuthHeaders(credentials),
      });
      const pageData = response.data?.data;

      if (Array.isArray(pageData)) {
        templates.push(...pageData);
      }

      nextPageUrl = response.data?.paging?.next ?? null;
    }

    return templates;
  }

  async getMessageTemplateByName(name: string): Promise<unknown | null> {
    const templates = await this.listMessageTemplates();

    const match = templates.find((template) => {
      if (
        typeof template === 'object' &&
        template !== null &&
        'name' in template
      ) {
        return (template as { name: string }).name === name;
      }

      return false;
    });

    return match ?? null;
  }

  async createMessageTemplate(body: Record<string, unknown>): Promise<unknown> {
    const credentials = this.getCredentials();
    const config: AxiosRequestConfig = {
      method: 'post',
      url: `${GRAPH_API_BASE}/${credentials.assetId}/message_templates`,
      headers: this.getAuthHeaders(credentials),
      data: body,
    };

    const response = await axios.request(config);

    return response.data;
  }

  async updateMessageTemplateComponents(
    templateId: string,
    components: unknown[],
  ): Promise<unknown> {
    const credentials = this.getCredentials();
    const response = await axios.post(
      `${GRAPH_API_BASE}/${templateId}`,
      { components },
      { headers: this.getAuthHeaders(credentials) },
    );

    return response.data;
  }

  async deleteMessageTemplateByName(name: string): Promise<unknown> {
    const credentials = this.getCredentials();
    const response = await axios.delete(
      `${GRAPH_API_BASE}/${credentials.assetId}/message_templates`,
      {
        headers: this.getAuthHeaders(credentials),
        params: { name },
      },
    );

    return response.data;
  }

  private buildBodyParameters(input: SendWorkflowFormTemplateInput) {
    return [
      {
        type: 'text',
        text: sanitizeWhatsappTemplateParam(input.contextText),
      },
      {
        type: 'text',
        text: sanitizeWhatsappTemplateParam(
          input.detailsText ?? 'See form fields',
        ),
      },
    ];
  }

  private buildBooleanQuickReplyTemplateBody(
    name: string,
  ): Record<string, unknown> {
    return {
      name,
      language: 'en_US',
      category: 'UTILITY',
      components: [
        {
          type: 'BODY',
          text: BOOLEAN_QR_BODY_TEXT,
          example: {
            body_text: BODY_EXAMPLE,
          },
        },
        {
          type: 'BUTTONS',
          buttons: [
            { type: 'QUICK_REPLY', text: 'Yes' },
            { type: 'QUICK_REPLY', text: 'No' },
          ],
        },
      ],
    };
  }

  private buildHostedUrlTemplateBody(
    name: string,
    serverBaseUrl: string,
  ): Record<string, unknown> {
    // Meta URL buttons: static prefix + {{1}} dynamic suffix (send passes token/fill)
    const url = `${serverBaseUrl}/workflow-approval/{{1}}`;

    return {
      name,
      language: 'en_US',
      category: 'UTILITY',
      components: [
        {
          type: 'BODY',
          text: HOSTED_URL_BODY_TEXT,
          example: {
            body_text: BODY_EXAMPLE,
          },
        },
        {
          type: 'BUTTONS',
          buttons: [
            {
              type: 'URL',
              text: 'Fill form',
              url,
              example: ['sample-token/fill'],
            },
          ],
        },
      ],
    };
  }

  private buildFlowButtonTemplateBody(
    templateName: string,
    flowIdentifier: { flowId?: string; flowName: string },
  ): Record<string, unknown> {
    const flowButton: Record<string, unknown> = {
      type: 'FLOW',
      text: 'Open form',
      flow_action: 'navigate',
      navigate_screen: 'FORM_SCREEN',
    };

    if (flowIdentifier.flowId) {
      flowButton.flow_id = flowIdentifier.flowId;
    } else {
      flowButton.flow_name = flowIdentifier.flowName;
    }

    return {
      name: templateName,
      language: 'en_US',
      category: 'UTILITY',
      components: [
        {
          type: 'BODY',
          text: FLOW_BODY_TEXT,
          example: {
            body_text: BODY_EXAMPLE,
          },
        },
        {
          type: 'BUTTONS',
          buttons: [flowButton],
        },
      ],
    };
  }

  private buildCreateBodyForRegistryEntry(
    entry: WorkflowFormRegistryEntry,
    serverBaseUrl: string,
  ): Record<string, unknown> {
    if (entry.templateKind === 'boolean_qr') {
      return this.buildBooleanQuickReplyTemplateBody(entry.name);
    }

    // Legacy URL templates still ensured for hosted + fallback
    return this.buildHostedUrlTemplateBody(entry.name, serverBaseUrl);
  }

  private indexTemplatesByName(
    existingTemplates: unknown[],
  ): Map<string, { id?: string; status?: string }> {
    const existingByName = new Map<string, { id?: string; status?: string }>();

    for (const template of existingTemplates) {
      if (
        typeof template === 'object' &&
        template !== null &&
        'name' in template
      ) {
        const namedTemplate = template as {
          name: string;
          id?: string;
          status?: string;
        };

        existingByName.set(namedTemplate.name, {
          id: namedTemplate.id,
          status: namedTemplate.status,
        });
      }
    }

    return existingByName;
  }

  async ensureRegistryTemplates(): Promise<EnsureRegistryTemplateResult[]> {
    const credentials = this.getCredentials();
    const existingByName = this.indexTemplatesByName(
      await this.listMessageTemplates(),
    );
    const results: EnsureRegistryTemplateResult[] = [];

    for (const entry of WORKFLOW_FORM_TEMPLATE_REGISTRY) {
      const existing = existingByName.get(entry.name);

      if (existing) {
        results.push({
          name: entry.name,
          templateKind: entry.templateKind,
          status: 'exists',
          templateId: existing.id,
          templateStatus: existing.status,
        });
        continue;
      }

      try {
        const createBody = this.buildCreateBodyForRegistryEntry(
          entry,
          credentials.serverBaseUrl,
        );
        const created = (await this.createMessageTemplate(createBody)) as {
          id?: string;
          status?: string;
        };

        this.logger.log(
          `Created WhatsApp template ${entry.name} id=${created?.id ?? 'unknown'}`,
        );

        results.push({
          name: entry.name,
          templateKind: entry.templateKind,
          status: 'created',
          templateId: created?.id,
          templateStatus: created?.status,
        });
      } catch (error) {
        const errorMessage =
          axios.isAxiosError(error) && error.response?.data
            ? JSON.stringify(error.response.data)
            : error instanceof Error
              ? error.message
              : String(error);

        this.logger.error(
          `Failed to create WhatsApp template ${entry.name}: ${errorMessage}`,
        );

        results.push({
          name: entry.name,
          templateKind: entry.templateKind,
          status: 'error',
          error: errorMessage,
        });
      }
    }

    return results;
  }

  // Create *_flow message templates that open published WhatsApp Flows
  async ensureRegistryFlowTemplates(): Promise<EnsureRegistryTemplateResult[]> {
    const flowEnsureResults =
      await this.facebookWhatsappWorkflowFormFlowService.ensureRegistryFlows();
    const flowIdByRegistryName = new Map(
      flowEnsureResults
        .filter((result) => result.flowId)
        .map((result) => [result.registryName, result.flowId as string]),
    );

    const existingByName = this.indexTemplatesByName(
      await this.listMessageTemplates(),
    );
    const results: EnsureRegistryTemplateResult[] = [];

    for (const entry of WORKFLOW_FORM_TEMPLATE_REGISTRY) {
      if (entry.templateKind !== 'flow_or_url') {
        results.push({
          name: getFlowTemplateNameForRegistry(entry.name),
          templateKind: 'flow_button',
          status: 'skipped',
        });
        continue;
      }

      const templateName = getFlowTemplateNameForRegistry(entry.name);
      const flowName = getFlowNameForRegistry(entry.name);
      const existing = existingByName.get(templateName);

      if (existing) {
        results.push({
          name: templateName,
          templateKind: 'flow_button',
          status: 'exists',
          templateId: existing.id,
          templateStatus: existing.status,
        });
        continue;
      }

      try {
        const created = (await this.createMessageTemplate(
          this.buildFlowButtonTemplateBody(templateName, {
            flowId: flowIdByRegistryName.get(entry.name),
            flowName,
          }),
        )) as { id?: string; status?: string };

        this.logger.log(
          `Created FLOW template ${templateName} → ${flowName} id=${created?.id ?? 'unknown'}`,
        );

        results.push({
          name: templateName,
          templateKind: 'flow_button',
          status: 'created',
          templateId: created?.id,
          templateStatus: created?.status,
        });
      } catch (error) {
        const errorMessage =
          axios.isAxiosError(error) && error.response?.data
            ? JSON.stringify(error.response.data)
            : error instanceof Error
              ? error.message
              : String(error);

        this.logger.error(
          `Failed to create FLOW template ${templateName}: ${errorMessage}`,
        );

        results.push({
          name: templateName,
          templateKind: 'flow_button',
          status: 'error',
          error: errorMessage,
        });
      }
    }

    return results;
  }

  private extractSelectOptions(
    formFields: SendWorkflowFormTemplateInput['formFields'],
    type: 'SELECT' | 'MULTI_SELECT',
  ): FlowOption[] {
    const field = (formFields ?? []).find(
      (formField) => formField.type.toUpperCase() === type,
    );
    const settings = field?.settings;
    const rawOptions = settings?.options;

    if (!Array.isArray(rawOptions) || rawOptions.length === 0) {
      // Placeholder so Flow still opens when options come from CRM field metadata later
      return [
        { id: 'option_a', title: 'Option A' },
        { id: 'option_b', title: 'Option B' },
      ];
    }

    return rawOptions
      .map((option, index) => {
        if (typeof option === 'string') {
          return { id: option, title: option };
        }

        if (typeof option === 'object' && option !== null) {
          const optionRecord = option as {
            value?: string;
            label?: string;
            id?: string;
            title?: string;
          };
          const id =
            optionRecord.value ??
            optionRecord.id ??
            `option_${index}`;
          const title =
            optionRecord.label ?? optionRecord.title ?? String(id);

          return { id: String(id), title: String(title).slice(0, 30) };
        }

        return null;
      })
      .filter((option): option is FlowOption => option !== null);
  }

  private findFirstFieldByType(
    formFields: SendWorkflowFormTemplateInput['formFields'],
    type: string,
  ) {
    return (formFields ?? []).find(
      (field) => field.type.toUpperCase() === type,
    );
  }

  private stringifySampleValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }

    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }

    if (Array.isArray(value)) {
      return value.map((entry) => String(entry)).join(', ');
    }

    return '';
  }

  private buildFlowActionData(
    input: SendWorkflowFormTemplateInput,
  ): Record<string, unknown> {
    const types = (input.formFields ?? []).map((field) =>
      field.type.toUpperCase(),
    );
    const data: Record<string, unknown> = {
      context_heading: sanitizeWhatsappTemplateParam(
        `${input.contextText} | ${input.detailsText ?? ''}`.trim(),
        80,
      ),
    };

    if (types.includes('TEXT')) {
      const textField = this.findFirstFieldByType(input.formFields, 'TEXT');

      data.text_init_value = this.stringifySampleValue(textField?.value);
      data.text_helper = sanitizeWhatsappTemplateParam(
        textField?.placeholder || textField?.label || 'Enter text',
        80,
      );
    }

    if (types.includes('NUMBER')) {
      const numberField = this.findFirstFieldByType(
        input.formFields,
        'NUMBER',
      );

      data.number_init_value = this.stringifySampleValue(numberField?.value);
      data.number_helper = sanitizeWhatsappTemplateParam(
        numberField?.placeholder || numberField?.label || 'Enter a number',
        80,
      );
    }

    if (types.includes('DATE')) {
      const dateField = this.findFirstFieldByType(input.formFields, 'DATE');

      data.date_init_value = this.stringifySampleValue(dateField?.value);
    }

    if (types.includes('SELECT')) {
      const selectField = this.findFirstFieldByType(
        input.formFields,
        'SELECT',
      );

      data.select_options = this.extractSelectOptions(
        input.formFields,
        'SELECT',
      );
      data.select_init_value = this.stringifySampleValue(selectField?.value);
    }

    if (types.includes('MULTI_SELECT')) {
      const multiSelectField = this.findFirstFieldByType(
        input.formFields,
        'MULTI_SELECT',
      );
      const rawValue = multiSelectField?.value;

      data.multi_select_options = this.extractSelectOptions(
        input.formFields,
        'MULTI_SELECT',
      );
      data.multi_select_init_value = Array.isArray(rawValue)
        ? rawValue.map((entry) => String(entry))
        : rawValue
          ? [String(rawValue)]
          : [];
    }

    return data;
  }

  private async sendUrlButtonTemplate(
    credentials: FacebookWhatsappCredentials,
    input: SendWorkflowFormTemplateInput,
    templateName: string,
  ): Promise<{ status: string; data: unknown }> {
    const payload = {
      messaging_product: 'whatsapp',
      to: input.to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en_US' },
        components: [
          {
            type: 'body',
            parameters: this.buildBodyParameters(input),
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [
              {
                type: 'text',
                text: buildWorkflowApprovalFillPath(input.token),
              },
            ],
          },
        ],
      },
    };

    const response = await axios.post(
      `${GRAPH_API_BASE}/${credentials.phoneNumberId}/messages`,
      payload,
      { headers: this.getAuthHeaders(credentials) },
    );

    return { status: 'sent', data: response.data };
  }

  private async sendFlowButtonTemplate(
    credentials: FacebookWhatsappCredentials,
    input: SendWorkflowFormTemplateInput,
    templateName: string,
  ): Promise<{ status: string; data: unknown }> {
    const payload = {
      messaging_product: 'whatsapp',
      to: input.to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en_US' },
        components: [
          {
            type: 'body',
            parameters: this.buildBodyParameters(input),
          },
          {
            type: 'button',
            sub_type: 'flow',
            index: '0',
            parameters: [
              {
                type: 'action',
                action: {
                  flow_token: input.token,
                  flow_action_data: this.buildFlowActionData(input),
                },
              },
            ],
          },
        ],
      },
    };

    const response = await axios.post(
      `${GRAPH_API_BASE}/${credentials.phoneNumberId}/messages`,
      payload,
      { headers: this.getAuthHeaders(credentials) },
    );

    return { status: 'sent_flow', data: response.data };
  }

  async sendWorkflowFormTemplate(
    input: SendWorkflowFormTemplateInput,
  ): Promise<{ status: string; data: unknown }> {
    const credentials = this.getCredentials();
    const entry = WORKFLOW_FORM_TEMPLATE_REGISTRY.find(
      (registryEntry) => registryEntry.name === input.registryName,
    );

    if (!entry) {
      throw new Error(`Unknown registry name: ${input.registryName}`);
    }

    if (entry.templateKind === 'boolean_qr') {
      const components: Record<string, unknown>[] = [
        {
          type: 'body',
          parameters: this.buildBodyParameters(input),
        },
        {
          type: 'button',
          sub_type: 'quick_reply',
          index: '0',
          parameters: [
            {
              type: 'payload',
              payload: buildWorkflowFormQuickReplyPayload(
                input.token,
                'approve',
              ),
            },
          ],
        },
        {
          type: 'button',
          sub_type: 'quick_reply',
          index: '1',
          parameters: [
            {
              type: 'payload',
              payload: buildWorkflowFormQuickReplyPayload(
                input.token,
                'reject',
              ),
            },
          ],
        },
      ];

      const payload = {
        messaging_product: 'whatsapp',
        to: input.to,
        type: 'template',
        template: {
          name: entry.name,
          language: { code: 'en_US' },
          components,
        },
      };

      const response = await axios.post(
        `${GRAPH_API_BASE}/${credentials.phoneNumberId}/messages`,
        payload,
        { headers: this.getAuthHeaders(credentials) },
      );

      return { status: 'sent', data: response.data };
    }

    if (entry.templateKind === 'hosted_url') {
      return this.sendUrlButtonTemplate(credentials, input, entry.name);
    }

    // Prefer in-WhatsApp Flow v2 (Backdrop {{1}} + Details {{2}}).
    // Do not fall back to legacy `*_flow` templates — several only have {{1}}.
    const flowTemplateName = getFlowTemplateNameForRegistry(entry.name);

    try {
      return await this.sendFlowButtonTemplate(
        credentials,
        input,
        flowTemplateName,
      );
    } catch (flowError) {
      const flowErrorMessage =
        axios.isAxiosError(flowError) && flowError.response?.data
          ? JSON.stringify(flowError.response.data)
          : flowError instanceof Error
            ? flowError.message
            : String(flowError);

      this.logger.warn(
        `FLOW send failed for ${flowTemplateName}, falling back to URL: ${flowErrorMessage}`,
      );

      return this.sendUrlButtonTemplate(credentials, input, entry.name);
    }
  }

  // Rewrite body copy on existing wf_form_* templates ({{1}} backdrop, {{2}} details)
  async syncRegistryTemplateBodies(): Promise<
    Array<{
      name: string;
      status: 'updated' | 'recreated' | 'error' | 'skipped';
      error?: string;
    }>
  > {
    const credentials = this.getCredentials();
    const templates = (await this.listMessageTemplates()) as Array<{
      id?: string;
      name?: string;
      status?: string;
      language?: string;
      components?: unknown[];
    }>;
    const results: Array<{
      name: string;
      status: 'updated' | 'recreated' | 'error' | 'skipped';
      error?: string;
    }> = [];

    const flowEnsureResults =
      await this.facebookWhatsappWorkflowFormFlowService.ensureRegistryFlows();
    const flowIdByRegistryName = new Map(
      flowEnsureResults
        .filter((result) => result.flowId)
        .map((result) => [result.registryName, result.flowId as string]),
    );

    for (const template of templates) {
      const name = template.name;

      if (!name?.startsWith('wf_form_') || !template.id) {
        continue;
      }

      const isFlowTemplate = name.endsWith('_flow');
      const registryName = isFlowTemplate
        ? name.replace(/_flow$/, '')
        : name;
      const entry = WORKFLOW_FORM_TEMPLATE_REGISTRY.find(
        (registryEntry) => registryEntry.name === registryName,
      );

      if (!entry && !isFlowTemplate) {
        results.push({ name, status: 'skipped' });
        continue;
      }

      let createBody: Record<string, unknown>;

      if (isFlowTemplate && entry) {
        createBody = this.buildFlowButtonTemplateBody(name, {
          flowId: flowIdByRegistryName.get(entry.name),
          flowName: getFlowNameForRegistry(entry.name),
        });
      } else if (entry?.templateKind === 'boolean_qr') {
        createBody = this.buildBooleanQuickReplyTemplateBody(name);
      } else {
        createBody = this.buildHostedUrlTemplateBody(
          name,
          credentials.serverBaseUrl,
        );
      }

      const components = createBody.components as unknown[];

      try {
        await this.updateMessageTemplateComponents(template.id, components);
        results.push({ name, status: 'updated' });
      } catch (updateError) {
        try {
          await this.deleteMessageTemplateByName(name);
          await this.createMessageTemplate(createBody);
          results.push({ name, status: 'recreated' });
        } catch (recreateError) {
          const errorMessage =
            axios.isAxiosError(recreateError) && recreateError.response?.data
              ? JSON.stringify(recreateError.response.data)
              : axios.isAxiosError(updateError) && updateError.response?.data
                ? JSON.stringify(updateError.response.data)
                : recreateError instanceof Error
                  ? recreateError.message
                  : String(recreateError);

          results.push({ name, status: 'error', error: errorMessage });
        }
      }
    }

    return results;
  }
}
