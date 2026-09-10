import { config } from 'dotenv';
import { resolve } from 'path';
import axios from 'axios';
import { buildWorkflowFormMetaPrunePlan } from '../src/engine/core-modules/arx-chat/services/workflow-approval/workflow-form-meta-keep.util';

config({ path: resolve(__dirname, '../.env') });

const GRAPH = 'https://graph.facebook.com/v21.0';

const main = async () => {
  const apiToken = process.env.FACEBOOK_WHATSAPP_API_TOKEN?.trim();
  const assetId = process.env.FACEBOOK_WHATSAPP_ASSET_ID?.trim();

  if (!apiToken || !assetId) {
    throw new Error('Missing credentials');
  }

  const headers = {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  };

  const templates: Array<{
    name: string;
    id: string;
    status?: string;
    category?: string;
  }> = [];
  let url: string | null = `${GRAPH}/${assetId}/message_templates`;

  while (url) {
    const response = await axios.get(url, {
      headers,
      params: { fields: 'name,id,status,category', limit: 100 },
    });

    for (const template of response.data?.data ?? []) {
      templates.push({
        name: String(template.name),
        id: String(template.id),
        status: template.status,
        category: template.category,
      });
    }

    url = response.data?.paging?.next ?? null;
  }

  const plan = buildWorkflowFormMetaPrunePlan(
    templates.map((template) => template.name),
  );
  const byName = new Map(
    templates.map((template) => [template.name, template]),
  );
  const deleteResults: Array<Record<string, unknown>> = [];

  for (const name of plan.delete) {
    const template = byName.get(name);

    if (!template) {
      deleteResults.push({ name, status: 'missing' });
      continue;
    }

    try {
      const deleted = await axios.delete(`${GRAPH}/${template.id}`, {
        headers,
      });
      deleteResults.push({
        name,
        id: template.id,
        status: 'deleted',
        data: deleted.data,
      });
    } catch (error) {
      deleteResults.push({
        name,
        id: template.id,
        status: 'error',
        detail: axios.isAxiosError(error) ? error.response?.data : error,
      });
    }
  }

  const remaining = templates
    .filter(
      (template) =>
        template.name.startsWith('wf_form') &&
        !plan.delete.includes(template.name),
    )
    .map((template) => ({
      name: template.name,
      status: template.status,
      category: template.category,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  // Also pick up newly created v4 if list was stale
  const refresh = await axios.get(`${GRAPH}/${assetId}/message_templates`, {
    headers,
    params: {
      name: 'wf_form_boolean_text_flow_v4',
      fields: 'name,status,category,id',
    },
  });

  console.log(
    JSON.stringify(
      {
        deleteResults,
        remainingBeforeRefresh: remaining,
        v4: refresh.data?.data?.[0] ?? null,
      },
      null,
      2,
    ),
  );
};

void main();
