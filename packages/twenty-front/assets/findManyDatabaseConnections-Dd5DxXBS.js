import{D as e}from"./useIsSettingsIntegrationEnabled-QBIf24TO.js";import{v as t}from"./index-BzerUb1B.js";const o=t`
  ${e}
  query GetManyDatabaseConnections($input: RemoteServerTypeInput!) {
    findManyRemoteServersByType(input: $input) {
      ...RemoteServerFields
    }
  }
`;export{o as G};
