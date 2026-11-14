/**
 * Token tracking utility for accumulating token usage across multiple API calls
 */

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens?: number; // For cached input tokens
};

export type StageTokenUsage = {
  stage: string;
  model: string;
  usage: TokenUsage;
  timestamp: Date;
};

export class TokenTracker {
  private stages: Map<string, StageTokenUsage[]> = new Map();
  private totalUsage: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    cachedTokens: 0,
  };

  /**
   * Record token usage for a specific stage
   */
  recordUsage(
    stage: string,
    model: string,
    usage: TokenUsage,
  ): void {
    if (!this.stages.has(stage)) {
      this.stages.set(stage, []);
    }

    const stageUsages = this.stages.get(stage)!;
    stageUsages.push({
      stage,
      model,
      usage,
      timestamp: new Date(),
    });

    // Update totals
    this.totalUsage.promptTokens += usage.promptTokens;
    this.totalUsage.completionTokens += usage.completionTokens;
    this.totalUsage.totalTokens += usage.totalTokens;
    if (usage.cachedTokens) {
      this.totalUsage.cachedTokens = (this.totalUsage.cachedTokens || 0) + usage.cachedTokens;
    }
  }

  /**
   * Get usage for a specific stage
   */
  getStageUsage(stage: string): StageTokenUsage[] {
    return this.stages.get(stage) || [];
  }

  /**
   * Get total usage across all stages
   */
  getTotalUsage(): TokenUsage {
    return { ...this.totalUsage };
  }

  /**
   * Get all stages with their usage
   */
  getAllStages(): Map<string, StageTokenUsage[]> {
    return new Map(this.stages);
  }

  /**
   * Get summary of usage by stage
   */
  getStageSummary(): Array<{
    stage: string;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    callCount: number;
    models: string[];
  }> {
    const summary: Array<{
      stage: string;
      totalPromptTokens: number;
      totalCompletionTokens: number;
      totalTokens: number;
      callCount: number;
      models: string[];
    }> = [];

    for (const [stage, usages] of this.stages.entries()) {
      const totalPromptTokens = usages.reduce((sum, u) => sum + u.usage.promptTokens, 0);
      const totalCompletionTokens = usages.reduce((sum, u) => sum + u.usage.completionTokens, 0);
      const totalTokens = usages.reduce((sum, u) => sum + u.usage.totalTokens, 0);
      const models = Array.from(new Set(usages.map(u => u.model)));

      summary.push({
        stage,
        totalPromptTokens,
        totalCompletionTokens,
        totalTokens,
        callCount: usages.length,
        models,
      });
    }

    return summary;
  }

  /**
   * Reset all tracking
   */
  reset(): void {
    this.stages.clear();
    this.totalUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cachedTokens: 0,
    };
  }
}
