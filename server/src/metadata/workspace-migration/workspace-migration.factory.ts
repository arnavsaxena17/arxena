import { Injectable, Logger } from '@nestjs/common';

import { WorkspaceColumnActionFactory } from 'src/metadata/workspace-migration/interfaces/workspace-column-action-factory.interface';
import { FieldMetadataInterface } from 'src/metadata/field-metadata/interfaces/field-metadata.interface';
import { WorkspaceColumnActionOptions } from 'src/metadata/workspace-migration/interfaces/workspace-column-action-options.interface';

import { FieldMetadataType } from 'src/metadata/field-metadata/field-metadata.entity';
import { BasicColumnActionFactory } from 'src/metadata/workspace-migration/factories/basic-column-action.factory';
import { EnumColumnActionFactory } from 'src/metadata/workspace-migration/factories/enum-column-action.factory';
import {
  WorkspaceMigrationColumnAction,
  WorkspaceMigrationColumnActionType,
} from 'src/metadata/workspace-migration/workspace-migration.entity';
import { isCompositeFieldMetadataType } from 'src/metadata/field-metadata/utils/is-composite-field-metadata-type.util';
import { linkObjectDefinition } from 'src/metadata/field-metadata/composite-types/link.composite-type';
import { currencyObjectDefinition } from 'src/metadata/field-metadata/composite-types/currency.composite-type';
import { fullNameObjectDefinition } from 'src/metadata/field-metadata/composite-types/full-name.composite-type';

@Injectable()
export class WorkspaceMigrationFactory {
  private readonly logger = new Logger(WorkspaceMigrationFactory.name);
  private factoriesMap: Map<
    FieldMetadataType,
    {
      factory: WorkspaceColumnActionFactory<any>;
      options?: WorkspaceColumnActionOptions;
    }
  >;
  private compositeDefinitions = new Map<string, FieldMetadataInterface[]>();

  constructor(
    private readonly basicColumnActionFactory: BasicColumnActionFactory,
    private readonly enumColumnActionFactory: EnumColumnActionFactory,
  ) {
    this.factoriesMap = new Map<
      FieldMetadataType,
      {
        factory: WorkspaceColumnActionFactory<any>;
        options?: WorkspaceColumnActionOptions;
      }
    >([
      [FieldMetadataType.UUID, { factory: this.basicColumnActionFactory }],
      [
        FieldMetadataType.TEXT,
        {
          factory: this.basicColumnActionFactory,
          options: {
            defaultValue: '',
          },
        },
      ],
      [
        FieldMetadataType.PHONE,
        {
          factory: this.basicColumnActionFactory,
          options: {
            defaultValue: '',
          },
        },
      ],
      [
        FieldMetadataType.EMAIL,
        {
          factory: this.basicColumnActionFactory,
          options: {
            defaultValue: '',
          },
        },
      ],
      [FieldMetadataType.NUMERIC, { factory: this.basicColumnActionFactory }],
      [FieldMetadataType.NUMBER, { factory: this.basicColumnActionFactory }],
      [
        FieldMetadataType.PROBABILITY,
        { factory: this.basicColumnActionFactory },
      ],
      [FieldMetadataType.BOOLEAN, { factory: this.basicColumnActionFactory }],
      [FieldMetadataType.DATE_TIME, { factory: this.basicColumnActionFactory }],
      [FieldMetadataType.RATING, { factory: this.enumColumnActionFactory }],
      [FieldMetadataType.SELECT, { factory: this.enumColumnActionFactory }],
      [
        FieldMetadataType.MULTI_SELECT,
        { factory: this.enumColumnActionFactory },
      ],
    ]);

    this.compositeDefinitions = new Map<string, FieldMetadataInterface[]>([
      [FieldMetadataType.LINK, linkObjectDefinition.fields],
      [FieldMetadataType.CURRENCY, currencyObjectDefinition.fields],
      [FieldMetadataType.FULL_NAME, fullNameObjectDefinition.fields],
    ]);
  }

  createColumnActions(
    action: WorkspaceMigrationColumnActionType.CREATE,
    fieldMetadata: FieldMetadataInterface,
  ): WorkspaceMigrationColumnAction[];
  createColumnActions(
    action: WorkspaceMigrationColumnActionType.ALTER,
    previousFieldMetadata: FieldMetadataInterface,
    nextFieldMetadata: FieldMetadataInterface,
  ): WorkspaceMigrationColumnAction[];
  createColumnActions(
    action:
      | WorkspaceMigrationColumnActionType.CREATE
      | WorkspaceMigrationColumnActionType.ALTER,
    fieldMetadataOrPreviousFieldMetadata: FieldMetadataInterface,
    undefinedOrnextFieldMetadata?: FieldMetadataInterface,
  ): WorkspaceMigrationColumnAction[] {
    const previousFieldMetadata =
      action === WorkspaceMigrationColumnActionType.ALTER
        ? fieldMetadataOrPreviousFieldMetadata
        : undefined;
    const nextFieldMetadata =
      action === WorkspaceMigrationColumnActionType.CREATE
        ? fieldMetadataOrPreviousFieldMetadata
        : undefinedOrnextFieldMetadata;

    if (!nextFieldMetadata) {
      this.logger.error(
        `No field metadata provided for action ${action}`,
        fieldMetadataOrPreviousFieldMetadata,
      );

      throw new Error(`No field metadata provided for action ${action}`);
    }

    // If it's a composite field type, we need to create a column action for each of the fields
    if (isCompositeFieldMetadataType(nextFieldMetadata.type)) {
      const fieldMetadataCollection = this.compositeDefinitions.get(
        nextFieldMetadata.type,
      );

      if (!fieldMetadataCollection) {
        this.logger.error(
          `No composite definition found for type ${nextFieldMetadata.type}`,
          {
            nextFieldMetadata,
          },
        );

        throw new Error(
          `No composite definition found for type ${nextFieldMetadata.type}`,
        );
      }

      return fieldMetadataCollection.map((fieldMetadata) =>
        this.createColumnAction(action, fieldMetadata, fieldMetadata),
      );
    }

    // Otherwise, we create a single column action
    const columnAction = this.createColumnAction(
      action,
      previousFieldMetadata,
      nextFieldMetadata,
    );

    return [columnAction];
  }

  private createColumnAction(
    action:
      | WorkspaceMigrationColumnActionType.CREATE
      | WorkspaceMigrationColumnActionType.ALTER,
    previousFieldMetadata: FieldMetadataInterface | undefined,
    nextFieldMetadata: FieldMetadataInterface,
  ): WorkspaceMigrationColumnAction {
    const { factory, options } =
      this.factoriesMap.get(nextFieldMetadata.type) ?? {};

    if (!factory) {
      this.logger.error(`No factory found for type ${nextFieldMetadata.type}`, {
        nextFieldMetadata,
      });

      throw new Error(`No factory found for type ${nextFieldMetadata.type}`);
    }

    return factory.create(
      action,
      previousFieldMetadata,
      nextFieldMetadata,
      options,
    );
  }
}
