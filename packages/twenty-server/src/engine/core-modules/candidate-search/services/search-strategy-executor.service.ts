import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { ParsedJobDescription } from '../../candidate-search/types/candidate-search-request.type';
import { FilterDescriptionProcessorService } from '../../candidate-sourcing/services/filter-description-processor.service';

export interface SearchStrategyNode {
  id: string;
  name: string;
  prompt: string;
  model: string;
  inputSources: string[];
  outputSchema: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  outputDestination: 'searchParameters' | 'enrichments' | 'filters' | 'intermediate';
  children: string[];
  parent?: string;
}

export interface SearchStrategyTree {
  treeVersion: string;
  rootNodeId: string;
  nodes: Record<string, SearchStrategyNode>;
  edges: Array<{ from: string; to: string }>;
}

export interface StrategyExecutionResult {
  searchParameters: Record<string, any>;
  enrichments: Array<{
    modelName: string;
    prompt: string;
    selectedModel: string;
    fields: Array<{ name: string; type: string; description: string; enumValues?: string[] }>;
    selectedMetadataFields: string[];
  }>;
  filters: Array<{
    fieldName: string;
    operator: string;
    value: any;
    fieldType: string;
  }>;
  executionLog: Array<{
    nodeId: string;
    status: 'success' | 'error';
    output?: any;
    error?: string;
    timestamp: string;
  }>;
}

@Injectable()
export class SearchStrategyExecutorService {
  private readonly logger = new Logger(SearchStrategyExecutorService.name);
  private readonly openai: OpenAI;

  constructor(
    private readonly filterDescriptionProcessorService: FilterDescriptionProcessorService,
  ) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_KEY,
    });
  }

  /**
   * Execute a search strategy tree with parsed job description
   */
  async executeTree(
    treeData: SearchStrategyTree,
    parsedJD: ParsedJobDescription,
    apiToken: string,
  ): Promise<StrategyExecutionResult> {
    this.logger.log(`Executing search strategy tree with ${Object.keys(treeData.nodes).length} nodes`);

    const executionLog: StrategyExecutionResult['executionLog'] = [];
    const nodeOutputs: Record<string, any> = {};
    const results: StrategyExecutionResult = {
      searchParameters: {},
      enrichments: [],
      filters: [],
      executionLog,
    };

    try {
      // Validate tree structure
      this.validateTreeStructure(treeData);

      // Execute tree breadth-first from root
      const executionQueue = [treeData.rootNodeId];
      const visited = new Set<string>();

      while (executionQueue.length > 0) {
        const currentNodeId = executionQueue.shift()!;
        
        if (visited.has(currentNodeId)) {
          continue;
        }

        const node = treeData.nodes[currentNodeId];
        if (!node) {
          this.logger.warn(`Node ${currentNodeId} not found in tree`);
          continue;
        }

        try {
          // Prepare input data for the node
          const inputData = this.prepareNodeInput(node, parsedJD, nodeOutputs);
          
          // Execute the node
          const nodeOutput = await this.executeNode(node, inputData);
          
          // Store output
          nodeOutputs[currentNodeId] = nodeOutput;
          
          // Add to results based on output destination
          this.addToResults(results, node, nodeOutput);
          
          // Log successful execution
          executionLog.push({
            nodeId: currentNodeId,
            status: 'success',
            output: nodeOutput,
            timestamp: new Date().toISOString(),
          });

          this.logger.log(`Successfully executed node: ${node.name}`);

          // Add children to queue
          node.children.forEach(childId => {
            if (!visited.has(childId)) {
              executionQueue.push(childId);
            }
          });

          visited.add(currentNodeId);
        } catch (error) {
          this.logger.error(`Error executing node ${currentNodeId}:`, error);
          
          executionLog.push({
            nodeId: currentNodeId,
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }
      }

      this.logger.log(`Strategy execution completed. Generated ${results.searchParameters ? Object.keys(results.searchParameters).length : 0} search parameters, ${results.enrichments.length} enrichments, ${results.filters.length} filters`);
      
      return results;
    } catch (error) {
      this.logger.error('Error executing search strategy tree:', error);
      throw new Error(`Failed to execute search strategy: ${error.message}`);
    }
  }

  /**
   * Execute a single node with input data
   */
  private async executeNode(node: SearchStrategyNode, inputData: any): Promise<any> {
    this.logger.log(`Executing node: ${node.name}`);

    try {
      // Build dynamic Zod schema from outputSchema
      const zodSchema = this.buildDynamicSchema(node.outputSchema);
      
      // Prepare the prompt with input data
      const processedPrompt = this.processPromptTemplate(node.prompt, inputData);
      
      // Call OpenAI with structured output
      const completion = await this.openai.chat.completions.create({
        model: node.model,
        messages: [
          { role: 'system', content: processedPrompt },
          { role: 'user', content: JSON.stringify(inputData) },
        ],
        response_format: zodResponseFormat(zodSchema, 'node_output'),
        temperature: 0,
        max_tokens: 2000,
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error('No response content from OpenAI');
      }

      const parsedResponse = JSON.parse(responseContent);
      this.logger.log(`Node ${node.name} executed successfully`);
      
      return parsedResponse;
    } catch (error) {
      this.logger.error(`Error executing node ${node.name}:`, error);
      throw error;
    }
  }

  /**
   * Build dynamic Zod schema from outputSchema
   */
  private buildDynamicSchema(outputSchema: SearchStrategyNode['outputSchema']): z.ZodSchema {
    const schemaFields: Record<string, z.ZodTypeAny> = {};

    for (const field of outputSchema) {
      const zodType = this.convertTypeToZod(field.type);
      schemaFields[field.name] = zodType.describe(field.description);
    }

    return z.object(schemaFields);
  }

  /**
   * Convert field type to Zod type
   */
  private convertTypeToZod(type: string): z.ZodTypeAny {
    switch (type.toLowerCase()) {
      case 'string':
        return z.string();
      case 'number':
        return z.number();
      case 'boolean':
        return z.boolean();
      case 'array<string>':
        return z.array(z.string());
      case 'array<number>':
        return z.array(z.number());
      case 'object':
        return z.record(z.any());
      default:
        this.logger.warn(`Unknown type ${type}, defaulting to string`);
        return z.string();
    }
  }

  /**
   * Prepare input data for a node based on its inputSources
   */
  private prepareNodeInput(
    node: SearchStrategyNode,
    parsedJD: ParsedJobDescription,
    nodeOutputs: Record<string, any>,
  ): any {
    const inputData: any = {};

    for (const source of node.inputSources) {
      // Check if source is from parsed JD
      if (source in parsedJD) {
        inputData[source] = parsedJD[source];
      }
      // Check if source is from parent node outputs
      else if (node.parent && nodeOutputs[node.parent]) {
        const parentOutput = nodeOutputs[node.parent];
        if (source in parentOutput) {
          inputData[source] = parentOutput[source];
        }
      }
    }

    return inputData;
  }

  /**
   * Process prompt template with input data
   */
  private processPromptTemplate(prompt: string, inputData: any): string {
    let processedPrompt = prompt;

    // Replace template variables with actual data
    Object.entries(inputData).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      processedPrompt = processedPrompt.replace(new RegExp(placeholder, 'g'), String(value));
    });

    return processedPrompt;
  }

  /**
   * Add node output to results based on outputDestination
   */
  private addToResults(
    results: StrategyExecutionResult,
    node: SearchStrategyNode,
    nodeOutput: any,
  ): void {
    switch (node.outputDestination) {
      case 'searchParameters':
        Object.assign(results.searchParameters, nodeOutput);
        break;
      
      case 'enrichments':
        // Convert node output to enrichment format
        const enrichment = this.convertToEnrichmentFormat(node, nodeOutput);
        results.enrichments.push(enrichment);
        break;
      
      case 'filters':
        // Convert node output to filter format
        const filters = this.convertToFilterFormat(node, nodeOutput);
        results.filters.push(...filters);
        break;
      
      case 'intermediate':
        // Do nothing - intermediate results are only passed to children
        break;
    }
  }

  /**
   * Convert node output to enrichment format
   */
  private convertToEnrichmentFormat(
    node: SearchStrategyNode,
    nodeOutput: any,
  ): StrategyExecutionResult['enrichments'][0] {
    return {
      modelName: node.name,
      prompt: node.prompt,
      selectedModel: node.model,
      fields: node.outputSchema.map(field => ({
        name: field.name,
        type: field.type,
        description: field.description,
        enumValues: field.type.includes('enum') ? [] : undefined,
      })),
      selectedMetadataFields: node.inputSources,
    };
  }

  /**
   * Convert node output to filter format
   */
  private convertToFilterFormat(
    node: SearchStrategyNode,
    nodeOutput: any,
  ): StrategyExecutionResult['filters'] {
    const filters: StrategyExecutionResult['filters'] = [];

    Object.entries(nodeOutput).forEach(([fieldName, value]) => {
      const fieldSchema = node.outputSchema.find(f => f.name === fieldName);
      if (fieldSchema) {
        filters.push({
          fieldName,
          operator: this.determineOperator(fieldSchema.type),
          value,
          fieldType: fieldSchema.type,
        });
      }
    });

    return filters;
  }

  /**
   * Determine filter operator based on field type
   */
  private determineOperator(fieldType: string): string {
    switch (fieldType.toLowerCase()) {
      case 'string':
        return 'contains';
      case 'number':
        return 'equals';
      case 'boolean':
        return 'equals';
      case 'array<string>':
        return 'in';
      default:
        return 'equals';
    }
  }

  /**
   * Validate tree structure
   */
  private validateTreeStructure(treeData: SearchStrategyTree): void {
    if (!treeData.rootNodeId) {
      throw new Error('Tree must have a root node');
    }

    if (!treeData.nodes[treeData.rootNodeId]) {
      throw new Error('Root node not found in nodes');
    }

    // Check for cycles (simplified check)
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) {
        return true;
      }
      if (visited.has(nodeId)) {
        return false;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const node = treeData.nodes[nodeId];
      if (node) {
        for (const childId of node.children) {
          if (hasCycle(childId)) {
            return true;
          }
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    if (hasCycle(treeData.rootNodeId)) {
      throw new Error('Tree contains cycles');
    }
  }
}
