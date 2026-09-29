import { Injectable, Logger, Optional } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { type LanguageModel } from 'ai';
import { readFileSync } from 'fs';
import { isDefined } from 'twenty-shared/utils';

import type { CompanySearchHit } from 'src/engine/core-modules/company-api/company-api.types';
import type { BrightDataGoogleMapsPlaceRecord } from 'src/engine/core-modules/bright-data/types/bright-data-google-maps-place.types';
import {
  buildLocalPlaceClassifierUserPrompt,
  LOCAL_PLACE_CLASSIFIER_MODEL_ID,
  LOCAL_PLACE_CLASSIFIER_SYSTEM_PROMPT,
} from 'src/engine/core-modules/outreach-command/prompts/local-place-classifier.prompt';
import {
  localPlaceClassifierLlmResultSchema,
  type LocalPlaceClassifierLlmResult,
} from 'src/engine/core-modules/outreach-command/schemas/local-place-classifier-llm.schema';
import { UpsertCompaniesService } from 'src/engine/core-modules/outreach-command/services/upsert-companies.service';
import { websiteFromBrightDataPlace } from 'src/engine/core-modules/outreach-command/utils/website-from-bright-data-place.util';
import {
  AiSdkExecutionService,
  runGenerateObject,
} from 'src/engine/metadata-modules/ai/ai-billing/services/ai-sdk-execution.service';
import { AiModelRegistryService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';
import { AI_TELEMETRY_CONFIG } from 'src/engine/metadata-modules/ai/ai-models/constants/ai-telemetry.const';

const CLASSIFY_CONCURRENCY = 8;
const DEFAULT_MIN_OUTLETS = 7;
const UPSERT_BATCH_SIZE = 50;

export type ClassifyAndUpsertLocalPlacesInput = {
  places?: unknown;
  placesFilePath?: string;
  projectId?: string;
  minOutlets?: number;
  modelId?: string;
  maxCompanies?: number;
};

export type LocalPlaceClassification = LocalPlaceClassifierLlmResult & {
  placeCountInDataset: number;
  website: string;
  mapsUrl: string;
  category: string;
  address: string;
  placeId: string;
  error?: string;
};

const toPlaceRecords = (value: unknown): BrightDataGoogleMapsPlaceRecord[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is BrightDataGoogleMapsPlaceRecord =>
      isDefined(item) && typeof item === 'object',
  );
};

const loadPlaces = (
  input: ClassifyAndUpsertLocalPlacesInput,
): BrightDataGoogleMapsPlaceRecord[] => {
  if (isNonEmptyString(input.placesFilePath)) {
    const raw = readFileSync(input.placesFilePath.trim(), 'utf8');
    const parsed = JSON.parse(raw) as unknown;

    return toPlaceRecords(parsed);
  }

  return toPlaceRecords(input.places);
};

type UniqueCompany = {
  name: string;
  placeCountInDataset: number;
  website: string;
  mapsUrl: string;
  category: string;
  address: string;
  placeId: string;
};

const uniqueCompaniesFromPlaces = (
  places: BrightDataGoogleMapsPlaceRecord[],
): UniqueCompany[] => {
  const byName = new Map<string, UniqueCompany>();

  for (const place of places) {
    const name = (place.name ?? '').toString().trim();

    if (!isNonEmptyString(name)) {
      continue;
    }

    const key = name.toLowerCase();
    const existing = byName.get(key);
    const website = websiteFromBrightDataPlace(place);
    const mapsUrl = (place.url ?? '').toString().trim();
    const category = (place.category ?? '').toString().trim();
    const address = (place.address ?? '').toString().trim();
    const placeId = (place.place_id ?? '').toString().trim();

    if (existing) {
      existing.placeCountInDataset += 1;
      if (!existing.website && website) {
        existing.website = website;
      }
      if (!existing.mapsUrl && mapsUrl) {
        existing.mapsUrl = mapsUrl;
      }
      if (!existing.category && category) {
        existing.category = category;
      }
      if (!existing.address && address) {
        existing.address = address;
      }
      continue;
    }

    byName.set(key, {
      name,
      placeCountInDataset: 1,
      website,
      mapsUrl,
      category,
      address,
      placeId,
    });
  }

  return [...byName.values()];
};

const classificationToCompanyHit = (
  classification: LocalPlaceClassification,
): CompanySearchHit => {
  const website =
    classification.website ||
    classification.mapsUrl ||
    classification.companyName;

  return {
    id: classification.placeId || classification.companyName,
    name: classification.companyName,
    website,
    linkedinUrl: classification.mapsUrl || website,
    industry: classification.category || 'Local business',
  };
};

@Injectable()
export class ClassifyAndUpsertLocalPlacesService {
  private readonly logger = new Logger(ClassifyAndUpsertLocalPlacesService.name);

  constructor(
    private readonly upsertCompaniesService: UpsertCompaniesService,
    @Optional()
    private readonly aiModelRegistryService?: AiModelRegistryService,
    @Optional()
    private readonly aiSdkExecutionService?: AiSdkExecutionService,
  ) {}

  async execute({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: ClassifyAndUpsertLocalPlacesInput;
  }): Promise<{
    success: boolean;
    uniqueNames: number;
    classified: number;
    qualifying: number;
    created: number;
    updated: number;
    skipped: number;
    companyIds: string[];
    classifications: LocalPlaceClassification[];
    qualifyingCompanies: LocalPlaceClassification[];
    error?: string;
  }> {
    const projectId = (input.projectId ?? '').trim();
    const minOutlets = Math.max(
      1,
      Number(input.minOutlets ?? DEFAULT_MIN_OUTLETS),
    );
    const maxCompanies = Math.max(
      0,
      Number(input.maxCompanies ?? Number.POSITIVE_INFINITY),
    );

    if (!isNonEmptyString(projectId)) {
      return this.failure('projectId is required');
    }

    let places: BrightDataGoogleMapsPlaceRecord[];

    try {
      places = loadPlaces(input);
    } catch (error) {
      return this.failure(
        `Failed to load places: ${error instanceof Error ? error.message : error}`,
      );
    }

    if (places.length === 0) {
      return this.failure(
        'places or placesFilePath with a JSON array is required',
      );
    }

    let companies = uniqueCompaniesFromPlaces(places);

    if (maxCompanies > 0 && Number.isFinite(maxCompanies)) {
      companies = companies.slice(0, maxCompanies);
    }

    const registeredModel = await this.resolveModel({
      workspaceId,
      modelId: input.modelId ?? LOCAL_PLACE_CLASSIFIER_MODEL_ID,
    });

    if (!registeredModel) {
      return this.failure(
        `AI model ${input.modelId ?? LOCAL_PLACE_CLASSIFIER_MODEL_ID} is not configured`,
      );
    }

    this.logger.log(
      `Local place classify start uniqueNames=${companies.length} model=${registeredModel.modelId} minOutlets=${minOutlets}`,
    );

    const classifications = await this.mapInBatches(
      companies,
      CLASSIFY_CONCURRENCY,
      (company) =>
        this.classifyOne({
          company,
          model: registeredModel.model,
          modelId: registeredModel.modelId,
          workspaceId,
        }),
    );

    const qualifyingCompanies = classifications.filter(
      (classification) =>
        !classification.error &&
        classification.isMultiOutlet === true &&
        classification.numberOutlets >= minOutlets,
    );

    const companyHits = qualifyingCompanies.map(classificationToCompanyHit);
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const companyIds: string[] = [];

    for (
      let offset = 0;
      offset < companyHits.length;
      offset += UPSERT_BATCH_SIZE
    ) {
      const batch = companyHits.slice(offset, offset + UPSERT_BATCH_SIZE);
      const upserted = await this.upsertCompaniesService.execute({
        workspaceId,
        input: { companies: batch, projectId },
      });

      created += Number(upserted.created ?? 0);
      updated += Number(upserted.updated ?? 0);
      skipped += Number(upserted.skipped ?? 0);

      if (Array.isArray(upserted.companyIds)) {
        companyIds.push(
          ...upserted.companyIds.filter((id): id is string =>
            isNonEmptyString(id),
          ),
        );
      }
    }

    this.logger.log(
      `Local place classify done qualifying=${qualifyingCompanies.length}/${companies.length} created=${created} updated=${updated}`,
    );

    return {
      success: true,
      uniqueNames: companies.length,
      classified: classifications.length,
      qualifying: qualifyingCompanies.length,
      created,
      updated,
      skipped,
      companyIds,
      classifications,
      qualifyingCompanies,
    };
  }

  private async classifyOne(input: {
    company: UniqueCompany;
    model: LanguageModel;
    modelId: string;
    workspaceId: string;
  }): Promise<LocalPlaceClassification> {
    const base = {
      companyName: input.company.name,
      isMultiOutlet: false,
      numberOutlets: 0,
      confidence: 0,
      reasoning: '',
      placeCountInDataset: input.company.placeCountInDataset,
      website: input.company.website,
      mapsUrl: input.company.mapsUrl,
      category: input.company.category,
      address: input.company.address,
      placeId: input.company.placeId,
    };

    try {
      const generationResult = await runGenerateObject(
        this.aiSdkExecutionService,
        {
          workspaceId: input.workspaceId,
          modelId: input.modelId,
          options: {
            model: input.model,
            system: LOCAL_PLACE_CLASSIFIER_SYSTEM_PROMPT,
            prompt: buildLocalPlaceClassifierUserPrompt(input.company.name),
            schema: localPlaceClassifierLlmResultSchema,
            experimental_telemetry: AI_TELEMETRY_CONFIG,
          },
        },
      );

      const parsed = localPlaceClassifierLlmResultSchema.parse(
        generationResult.object,
      );

      return {
        ...base,
        ...parsed,
        companyName: parsed.companyName || input.company.name,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(
        `Local place classify failed name="${input.company.name}": ${message}`,
      );

      return {
        ...base,
        error: message,
        reasoning: message,
      };
    }
  }

  private async resolveModel(input: {
    workspaceId: string;
    modelId: string;
  }): Promise<{ modelId: string; model: LanguageModel } | null> {
    if (!this.aiModelRegistryService) {
      return null;
    }

    const registeredModel =
      this.aiModelRegistryService.getModel(input.modelId) ??
      this.aiModelRegistryService.getDefaultSpeedModel();

    if (!registeredModel?.model) {
      return null;
    }

    return {
      modelId: registeredModel.modelId ?? input.modelId,
      model: registeredModel.model,
    };
  }

  private async mapInBatches<TItem, TResult>(
    items: TItem[],
    concurrency: number,
    mapper: (item: TItem, index: number) => Promise<TResult>,
  ): Promise<TResult[]> {
    const results: TResult[] = new Array(items.length);
    let nextIndex = 0;

    const workers = Array.from(
      { length: Math.min(concurrency, items.length) },
      async () => {
        while (nextIndex < items.length) {
          const index = nextIndex;

          nextIndex += 1;
          results[index] = await mapper(items[index], index);
        }
      },
    );

    await Promise.all(workers);

    return results;
  }

  private failure(error: string) {
    return {
      success: false,
      uniqueNames: 0,
      classified: 0,
      qualifying: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      companyIds: [] as string[],
      classifications: [] as LocalPlaceClassification[],
      qualifyingCompanies: [] as LocalPlaceClassification[],
      error,
    };
  }
}
