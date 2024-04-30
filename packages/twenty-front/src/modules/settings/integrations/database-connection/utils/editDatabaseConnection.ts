import { identity, isEmpty, pickBy } from 'lodash';
import { z } from 'zod';

import { settingsIntegrationPostgreSQLConnectionFormSchema } from '@/settings/integrations/database-connection/components/SettingsIntegrationDatabaseConnectionForm';
import { RemoteServer } from '~/generated-metadata/graphql';

export const getEditionSchemaForForm = (databaseKey: string) => {
  switch (databaseKey) {
    case 'postgresql':
      return settingsIntegrationPostgreSQLConnectionFormSchema.extend({
        password: z.string().optional(),
      });
    default:
      throw new Error(`No schema found for database key: ${databaseKey}`);
  }
};

export const getFormDefaultValuesFromConnection = ({
  databaseKey,
  connection,
}: {
  databaseKey: string;
  connection: RemoteServer;
}) => {
  switch (databaseKey) {
    case 'postgresql':
      return {
        dbname: connection.foreignDataWrapperOptions.dbname,
        host: connection.foreignDataWrapperOptions.host,
        port: connection.foreignDataWrapperOptions.port,
        username: connection.userMappingOptions?.username || undefined,
        schema: connection.schema || undefined,
        password: '',
      };
    default:
      throw new Error(
        `No default form values for database key: ${databaseKey}`,
      );
  }
};

export const formatValuesForUpdate = ({
  databaseKey,
  formValues,
}: {
  databaseKey: string;
  formValues: any;
}) => {
  switch (databaseKey) {
    case 'postgresql': {
      const formattedValues = {
        userMappingOptions: pickBy(
          {
            username: formValues.username,
            password: formValues.password,
          },
          identity,
        ),
        foreignDataWrapperOptions: pickBy(
          {
            dbname: formValues.dbname,
            host: formValues.host,
            port: formValues.port,
          },
          identity,
        ),
        schema: formValues.schema,
      };

      return pickBy(formattedValues, (obj) => !isEmpty(obj));
    }
    default:
      throw new Error(`Cannot format values for database key: ${databaseKey}`);
  }
};
