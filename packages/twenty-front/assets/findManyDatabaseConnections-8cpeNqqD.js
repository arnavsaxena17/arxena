import{D as e}from"./useIsSettingsIntegrationEnabled-GkLBa4L6.js";import{v as t}from"./index-DB0OKRlD.js";const o=t`
  ${e}
  query GetManyDatabaseConnections($input: RemoteServerTypeInput!) {
    findManyRemoteServersByType(input: $input) {
      ...RemoteServerFields
    }
  }
`;export{o as G};
