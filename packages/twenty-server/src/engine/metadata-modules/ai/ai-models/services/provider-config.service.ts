import { Injectable } from '@nestjs/common';

import { type ConfigVariables } from 'src/engine/core-modules/twenty-config/config-variables';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { DefaultAiCatalogService } from 'src/engine/metadata-modules/ai/ai-models/services/default-ai-catalog.service';

import { type AiProviderConfig } from 'src/engine/metadata-modules/ai/ai-models/types/ai-provider-config.type';
import { type AiProvidersConfig } from 'src/engine/metadata-modules/ai/ai-models/types/ai-providers-config.type';
import { extractConfigVariableName } from 'src/engine/metadata-modules/ai/ai-models/utils/extract-config-variable-name.util';

@Injectable()
export class ProviderConfigService {
  constructor(
    private readonly twentyConfigService: TwentyConfigService,
    private readonly defaultAiCatalogService: DefaultAiCatalogService,
  ) {}

  getCatalogProviderNames(): Set<string> {
    return new Set(
      Object.keys(this.defaultAiCatalogService.getDefaultAiCatalog()),
    );
  }

  getResolvedProviders(): AiProvidersConfig {
    const rawCatalog = this.defaultAiCatalogService.getDefaultAiCatalog();
    // Only resolve {{VAR}} templates that the catalog itself declares.
    // Prevents AI_PROVIDERS from exfiltrating arbitrary config secrets
    // (e.g. {{DATABASE_URL}}) while still allowing {{NOUS_API_KEY}}.
    const catalogTemplateVars =
      this.collectTemplateVariableNames(rawCatalog);
    const catalog = this.resolveTemplates(rawCatalog);
    const custom = this.twentyConfigService.get('AI_PROVIDERS') ?? {};
    const resolvedCustom = this.resolveTemplates(
      custom,
      catalogTemplateVars,
    );

    return this.mergeProviders(catalog, resolvedCustom);
  }

  private collectTemplateVariableNames(
    providers: AiProvidersConfig,
  ): Set<string> {
    const names = new Set<string>();

    for (const config of Object.values(providers)) {
      for (const field of [
        config.apiKey,
        config.accessKeyId,
        config.secretAccessKey,
        config.baseUrl,
      ]) {
        const varName = extractConfigVariableName(field);

        if (varName) {
          names.add(varName);
        }
      }
    }

    return names;
  }

  private resolveTemplates(
    providers: AiProvidersConfig,
    allowedTemplateVars?: Set<string>,
  ): AiProvidersConfig {
    const result: AiProvidersConfig = {};

    for (const [name, config] of Object.entries(providers)) {
      result[name] = this.resolveProviderTemplates(
        config,
        allowedTemplateVars,
      );
    }

    return result;
  }

  private resolveProviderTemplates(
    config: AiProviderConfig,
    allowedTemplateVars?: Set<string>,
  ): AiProviderConfig {
    return {
      ...config,
      baseUrl: this.resolveTemplate(config.baseUrl, allowedTemplateVars),
      apiKey: this.resolveTemplate(config.apiKey, allowedTemplateVars),
      accessKeyId: this.resolveTemplate(
        config.accessKeyId,
        allowedTemplateVars,
      ),
      secretAccessKey: this.resolveTemplate(
        config.secretAccessKey,
        allowedTemplateVars,
      ),
    };
  }

  private resolveTemplate(
    value?: string,
    allowedTemplateVars?: Set<string>,
  ): string | undefined {
    if (!value) {
      return value;
    }

    const varName = extractConfigVariableName(value);

    if (!varName) {
      return value;
    }

    if (allowedTemplateVars && !allowedTemplateVars.has(varName)) {
      return value;
    }

    // Registered config variables first (supports admin panel / DB overrides),
    // then fall back to process.env for vars not in ConfigVariables
    // (e.g. when CI replaces the catalog with custom provider entries).
    try {
      const resolved = this.twentyConfigService.get(
        varName as keyof ConfigVariables,
      ) as string | undefined;

      if (resolved) {
        return resolved;
      }
    } catch {
      // Not a registered config variable — fall through to env
    }

    return process.env[varName] || undefined;
  }

  private mergeProviders(
    catalog: AiProvidersConfig,
    custom: AiProvidersConfig,
  ): AiProvidersConfig {
    const result: AiProvidersConfig = { ...catalog };

    for (const [name, customConfig] of Object.entries(custom)) {
      const catalogConfig = catalog[name];

      if (!catalogConfig) {
        result[name] = customConfig;
        continue;
      }

      // Drop undefined credential fields so catalog keys survive partial overrides
      const definedCustomEntries = Object.entries(customConfig).filter(
        ([, value]) => value !== undefined,
      );

      result[name] = {
        ...catalogConfig,
        ...Object.fromEntries(definedCustomEntries),
      };
    }

    return result;
  }
}
