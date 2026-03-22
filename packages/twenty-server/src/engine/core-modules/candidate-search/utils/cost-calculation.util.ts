/**
 * Cost calculation utility based on model pricing
 * Pricing from OpenAI API (per 1M tokens)
 */

export type ModelPricing = {
  input: number; // per 1M tokens
  cachedInput?: number; // per 1M tokens (if available)
  output: number; // per 1M tokens
};

// Model pricing table (prices per 1M tokens)
const MODEL_PRICING: Record<string, ModelPricing> = {
  'gpt-5.2': { input: 1.75, cachedInput: 0.175, output: 14.00 },
  'gpt-5.1': { input: 1.25, cachedInput: 0.125, output: 10.00 },
  'gpt-5': { input: 1.25, cachedInput: 0.125, output: 10.00 },
  'gpt-5-mini': { input: 0.25, cachedInput: 0.025, output: 2.00 },
  'gpt-5-nano': { input: 0.05, cachedInput: 0.005, output: 0.40 },
  'gpt-5.2-chat-latest': { input: 1.75, cachedInput: 0.175, output: 14.00 },
  'gpt-5.1-chat-latest': { input: 1.25, cachedInput: 0.125, output: 10.00 },
  'gpt-5-chat-latest': { input: 1.25, cachedInput: 0.125, output: 10.00 },
  'gpt-5.1-codex-max': { input: 1.25, cachedInput: 0.125, output: 10.00 },
  'gpt-5.1-codex': { input: 1.25, cachedInput: 0.125, output: 10.00 },
  'gpt-5-codex': { input: 1.25, cachedInput: 0.125, output: 10.00 },
  'gpt-5.2-pro': { input: 21.00, output: 168.00 },
  'gpt-5-pro': { input: 15.00, output: 120.00 },
  'gpt-5.4': { input: 2.50, cachedInput: 0.25, output: 15.00 },
  'gpt-5.4-mini': { input: 0.75, cachedInput: 0.075, output: 4.50 },
  'gpt-5.4-nano': { input: 0.20, cachedInput: 0.02, output: 1.25 },
  'gpt-5.4-pro': { input: 30.00, output: 180.00 },
  'gpt-5.3-chat-latest': { input: 1.75, cachedInput: 0.175, output: 14.00 },
  'gpt-5.3-codex': { input: 1.75, cachedInput: 0.175, output: 14.00 },
  'gpt-4.1': { input: 2.00, cachedInput: 0.50, output: 8.00 },
  'gpt-4.1-mini': { input: 0.40, cachedInput: 0.10, output: 1.60 },
  'gpt-4.1-nano': { input: 0.10, cachedInput: 0.025, output: 0.40 },
  'gpt-4o': { input: 2.50, cachedInput: 1.25, output: 10.00 },
  'gpt-4o-2024-05-13': { input: 5.00, output: 15.00 },
  'gpt-4o-mini': { input: 0.15, cachedInput: 0.075, output: 0.60 },
  'gpt-realtime': { input: 4.00, cachedInput: 0.40, output: 16.00 },
  'gpt-realtime-mini': { input: 0.60, cachedInput: 0.06, output: 2.40 },
  'gpt-4o-realtime-preview': { input: 5.00, cachedInput: 2.50, output: 20.00 },
  'gpt-4o-mini-realtime-preview': { input: 0.60, cachedInput: 0.30, output: 2.40 },
  'gpt-audio': { input: 2.50, output: 10.00 },
  'gpt-audio-mini': { input: 0.60, output: 2.40 },
  'gpt-4o-audio-preview': { input: 2.50, output: 10.00 },
  'gpt-4o-mini-audio-preview': { input: 0.15, output: 0.60 },
  'o1': { input: 15.00, cachedInput: 7.50, output: 60.00 },
  'o1-pro': { input: 150.00, output: 600.00 },
  'o3-pro': { input: 20.00, output: 80.00 },
  'o3': { input: 2.00, cachedInput: 0.50, output: 8.00 },
  'o3-deep-research': { input: 10.00, cachedInput: 2.50, output: 40.00 },
  'o4-mini': { input: 1.10, cachedInput: 0.275, output: 4.40 },
  'o4-mini-deep-research': { input: 1.10, cachedInput: 0.275, output: 4.40 },
  'o3-mini': { input: 1.10, cachedInput: 0.55, output: 4.40 },
  'o1-mini': { input: 1.10, cachedInput: 0.55, output: 4.40 },
  'gpt-5.1-codex-mini': { input: 0.25, cachedInput: 0.025, output: 2.00 },
  'codex-mini-latest': { input: 1.50, cachedInput: 0.375, output: 6.00 },
  'gpt-5-search-api': { input: 1.25, cachedInput: 0.125, output: 10.00 },
  'gpt-4o-mini-search-preview': { input: 0.15, output: 0.60 },
  'gpt-4o-search-preview': { input: 2.50, output: 10.00 },
  'computer-use-preview': { input: 3.00, output: 12.00 },
  'gpt-image-1.5': { input: 5.00, cachedInput: 1.25, output: 10.00 },
  'chatgpt-image-latest': { input: 5.00, cachedInput: 1.25, output: 10.00 },
  'gpt-image-1': { input: 5.00, cachedInput: 1.25, output: 0 },
  'gpt-image-1-mini': { input: 2.00, cachedInput: 0.20, output: 0 },
};

export type CostBreakdown = {
  model: string;
  inputTokens: number;
  cachedTokens?: number;
  outputTokens: number;
  inputCost: number;
  cachedCost?: number;
  outputCost: number;
  totalCost: number;
};

/**
 * Calculate cost for a single API call
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedTokens?: number,
): CostBreakdown {
  // Normalize model name (remove version suffixes for matching)
  const normalizedModel = normalizeModelName(model);
  const pricing = MODEL_PRICING[normalizedModel];

  if (!pricing) {
    // Fallback to gpt-5.1-chat-latest pricing if model not found
    console.warn(`Model ${model} not found in pricing table, using gpt-5.1-chat-latest pricing`);
    const fallbackPricing = MODEL_PRICING['gpt-5.1-chat-latest'];
    return calculateCostWithPricing(fallbackPricing, inputTokens, outputTokens, cachedTokens, model);
  }

  return calculateCostWithPricing(pricing, inputTokens, outputTokens, cachedTokens, model);
}

/**
 * Calculate cost with specific pricing
 */
function calculateCostWithPricing(
  pricing: ModelPricing,
  inputTokens: number,
  outputTokens: number,
  cachedTokens: number | undefined,
  model: string,
): CostBreakdown {
  // Calculate costs (prices are per 1M tokens)
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  
  let cachedCost: number | undefined;
  if (cachedTokens && cachedTokens > 0 && pricing.cachedInput) {
    cachedCost = (cachedTokens / 1_000_000) * pricing.cachedInput;
    // Adjust input cost: subtract cached tokens from input tokens
    const nonCachedInputTokens = inputTokens - cachedTokens;
    const adjustedInputCost = (nonCachedInputTokens / 1_000_000) * pricing.input;
    return {
      model,
      inputTokens,
      cachedTokens,
      outputTokens,
      inputCost: adjustedInputCost,
      cachedCost,
      outputCost,
      totalCost: adjustedInputCost + cachedCost + outputCost,
    };
  }

  return {
    model,
    inputTokens,
    cachedTokens,
    outputTokens,
    inputCost,
    cachedCost,
    outputCost,
    totalCost: inputCost + outputCost,
  };
}

/**
 * Normalize model name for pricing lookup
 */
function normalizeModelName(model: string): string {
  // Try exact match first
  if (MODEL_PRICING[model]) {
    return model;
  }

  // Try common variations
  const variations = [
    model,
    model.replace(/-latest$/, ''),
    model.replace(/-\d{4}-\d{2}-\d{2}$/, ''),
    model.split('-').slice(0, 3).join('-'), // e.g., gpt-5.1-chat-latest -> gpt-5.1-chat
  ];

  for (const variation of variations) {
    if (MODEL_PRICING[variation]) {
      return variation;
    }
  }

  // Return original if no match found
  return model;
}

/**
 * Calculate total cost from multiple cost breakdowns
 */
export function calculateTotalCost(costBreakdowns: CostBreakdown[]): {
  totalInputTokens: number;
  totalCachedTokens: number;
  totalOutputTokens: number;
  totalInputCost: number;
  totalCachedCost: number;
  totalOutputCost: number;
  totalCost: number;
  byModel: Record<string, CostBreakdown>;
} {
  const byModel: Record<string, CostBreakdown> = {};
  let totalInputTokens = 0;
  let totalCachedTokens = 0;
  let totalOutputTokens = 0;
  let totalInputCost = 0;
  let totalCachedCost = 0;
  let totalOutputCost = 0;
  let totalCost = 0;

  for (const breakdown of costBreakdowns) {
    // Aggregate by model
    if (!byModel[breakdown.model]) {
      byModel[breakdown.model] = {
        model: breakdown.model,
        inputTokens: 0,
        outputTokens: 0,
        inputCost: 0,
        outputCost: 0,
        totalCost: 0,
      };
    }

    const modelBreakdown = byModel[breakdown.model];
    modelBreakdown.inputTokens += breakdown.inputTokens;
    modelBreakdown.outputTokens += breakdown.outputTokens;
    modelBreakdown.inputCost += breakdown.inputCost;
    modelBreakdown.outputCost += breakdown.outputCost;
    modelBreakdown.totalCost += breakdown.totalCost;

    if (breakdown.cachedTokens) {
      modelBreakdown.cachedTokens = (modelBreakdown.cachedTokens || 0) + breakdown.cachedTokens;
      modelBreakdown.cachedCost = (modelBreakdown.cachedCost || 0) + (breakdown.cachedCost || 0);
    }

    // Update totals
    totalInputTokens += breakdown.inputTokens;
    totalOutputTokens += breakdown.outputTokens;
    totalInputCost += breakdown.inputCost;
    totalOutputCost += breakdown.outputCost;
    totalCost += breakdown.totalCost;

    if (breakdown.cachedTokens) {
      totalCachedTokens += breakdown.cachedTokens;
      totalCachedCost += breakdown.cachedCost || 0;
    }
  }

  return {
    totalInputTokens,
    totalCachedTokens,
    totalOutputTokens,
    totalInputCost,
    totalCachedCost,
    totalOutputCost,
    totalCost,
    byModel,
  };
}
