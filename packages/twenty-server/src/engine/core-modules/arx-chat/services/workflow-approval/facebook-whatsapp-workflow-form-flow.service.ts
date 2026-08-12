import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';

import {
  buildWorkflowFormFlowJson,
  getFlowNameForRegistry,
  getFlowTypesForRegistryName,
} from './workflow-form-flow-json.builder';
import {
  WORKFLOW_FORM_TEMPLATE_REGISTRY,
  type WorkflowFormRegistryName,
} from './workflow-form-template.registry';

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export type EnsureFlowResult = {
  registryName: WorkflowFormRegistryName;
  flowName: string;
  status: 'exists' | 'created' | 'published' | 'updated' | 'error' | 'skipped';
  flowId?: string;
  error?: string;
};

@Injectable()
export class FacebookWhatsappWorkflowFormFlowService {
  private readonly logger = new Logger(
    FacebookWhatsappWorkflowFormFlowService.name,
  );

  // In-memory cache of flow ids after ensure (process lifetime)
  private readonly flowIdByRegistryName = new Map<string, string>();

  private getCredentials() {
    const apiToken = process.env.FACEBOOK_WHATSAPP_API_TOKEN?.trim();
    const assetId = process.env.FACEBOOK_WHATSAPP_ASSET_ID?.trim();

    if (!apiToken || !assetId) {
      throw new Error(
        'Missing FACEBOOK_WHATSAPP_API_TOKEN or FACEBOOK_WHATSAPP_ASSET_ID',
      );
    }

    return { apiToken, assetId };
  }

  private getAuthHeaders(apiToken: string) {
    return {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    };
  }

  getCachedFlowId(registryName: string): string | undefined {
    return this.flowIdByRegistryName.get(registryName);
  }

  async listFlows(): Promise<
    Array<{ id: string; name: string; status?: string }>
  > {
    const { apiToken, assetId } = this.getCredentials();
    const flows: Array<{ id: string; name: string; status?: string }> = [];
    let nextPageUrl: string | null = `${GRAPH_API_BASE}/${assetId}/flows`;

    while (nextPageUrl) {
      const response = await axios.get(nextPageUrl, {
        headers: this.getAuthHeaders(apiToken),
        params: { fields: 'id,name,status' },
      });
      const pageData = response.data?.data;

      if (Array.isArray(pageData)) {
        for (const flow of pageData) {
          flows.push({
            id: String(flow.id),
            name: String(flow.name),
            status: flow.status,
          });
        }
      }

      nextPageUrl = response.data?.paging?.next ?? null;
    }

    return flows;
  }

  private async uploadFlowJsonAndPublish(
    flowId: string,
    apiToken: string,
    flowJson: Record<string, unknown>,
  ): Promise<void> {
    const formData = new FormData();
    const flowJsonBuffer = Buffer.from(JSON.stringify(flowJson), 'utf8');

    formData.append('file', flowJsonBuffer, {
      filename: 'flow.json',
      contentType: 'application/json',
    });
    formData.append('name', 'flow.json');
    formData.append('asset_type', 'FLOW_JSON');

    await axios.post(`${GRAPH_API_BASE}/${flowId}/assets`, formData, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        ...formData.getHeaders(),
      },
    });

    await axios.post(
      `${GRAPH_API_BASE}/${flowId}/publish`,
      {},
      { headers: this.getAuthHeaders(apiToken) },
    );
  }

  async ensureRegistryFlows(options?: {
    forceUpdate?: boolean;
  }): Promise<EnsureFlowResult[]> {
    const forceUpdate = options?.forceUpdate === true;
    const { apiToken, assetId } = this.getCredentials();
    const existingFlows = await this.listFlows();
    const existingByName = new Map(
      existingFlows.map((flow) => [flow.name, flow]),
    );
    const results: EnsureFlowResult[] = [];

    for (const entry of WORKFLOW_FORM_TEMPLATE_REGISTRY) {
      if (entry.templateKind !== 'flow_or_url') {
        results.push({
          registryName: entry.name,
          flowName: getFlowNameForRegistry(entry.name),
          status: 'skipped',
        });
        continue;
      }

      const flowName = getFlowNameForRegistry(entry.name);
      const types = getFlowTypesForRegistryName(entry.name);
      const flowJson = buildWorkflowFormFlowJson(types);
      const existing = existingByName.get(flowName);

      if (existing && !forceUpdate) {
        this.flowIdByRegistryName.set(entry.name, existing.id);
        results.push({
          registryName: entry.name,
          flowName,
          status: 'exists',
          flowId: existing.id,
        });
        continue;
      }

      if (existing && forceUpdate) {
        try {
          await this.uploadFlowJsonAndPublish(
            existing.id,
            apiToken,
            flowJson,
          );
          this.flowIdByRegistryName.set(entry.name, existing.id);
          this.logger.log(
            `Updated+published WhatsApp Flow ${flowName} id=${existing.id}`,
          );
          results.push({
            registryName: entry.name,
            flowName,
            status: 'updated',
            flowId: existing.id,
          });
        } catch (error) {
          const errorMessage =
            axios.isAxiosError(error) && error.response?.data
              ? JSON.stringify(error.response.data)
              : error instanceof Error
                ? error.message
                : String(error);

          this.logger.error(
            `Failed to update Flow ${flowName}: ${errorMessage}`,
          );
          results.push({
            registryName: entry.name,
            flowName,
            status: 'error',
            flowId: existing.id,
            error: errorMessage,
          });
        }
        continue;
      }

      try {
        const createResponse = await axios.post(
          `${GRAPH_API_BASE}/${assetId}/flows`,
          {
            name: flowName,
            categories: ['OTHER'],
            flow_json: JSON.stringify(flowJson),
            publish: true,
          },
          { headers: this.getAuthHeaders(apiToken) },
        );

        const flowId = String(createResponse.data?.id ?? '');

        if (flowId) {
          this.flowIdByRegistryName.set(entry.name, flowId);
        }

        this.logger.log(
          `Created+published WhatsApp Flow ${flowName} id=${flowId}`,
        );

        results.push({
          registryName: entry.name,
          flowName,
          status: 'published',
          flowId,
        });
      } catch (error) {
        // Fallback: create draft then upload assets then publish
        try {
          const createDraft = await axios.post(
            `${GRAPH_API_BASE}/${assetId}/flows`,
            {
              name: flowName,
              categories: ['OTHER'],
            },
            { headers: this.getAuthHeaders(apiToken) },
          );
          const flowId = String(createDraft.data?.id ?? '');

          if (!flowId) {
            throw new Error('Flow create returned no id');
          }

          await this.uploadFlowJsonAndPublish(flowId, apiToken, flowJson);

          this.flowIdByRegistryName.set(entry.name, flowId);
          results.push({
            registryName: entry.name,
            flowName,
            status: 'published',
            flowId,
          });
        } catch (fallbackError) {
          const errorMessage =
            axios.isAxiosError(fallbackError) && fallbackError.response?.data
              ? JSON.stringify(fallbackError.response.data)
              : axios.isAxiosError(error) && error.response?.data
                ? JSON.stringify(error.response.data)
                : fallbackError instanceof Error
                  ? fallbackError.message
                  : String(fallbackError);

          this.logger.error(
            `Failed to ensure Flow ${flowName}: ${errorMessage}`,
          );
          results.push({
            registryName: entry.name,
            flowName,
            status: 'error',
            error: errorMessage,
          });
        }
      }
    }

    return results;
  }
}
