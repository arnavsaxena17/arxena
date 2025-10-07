import{v as s,aK as T,aZ as p}from"./index-DB0OKRlD.js";const r=s`
  fragment RemoteTableFields on RemoteTable {
    id
    name
    schema
    status
    schemaPendingUpdates
  }
`,b=s`
  ${r}
  query GetManyRemoteTables($input: FindManyRemoteTablesInput!) {
    findDistantTablesWithStatus(input: $input) {
      ...RemoteTableFields
    }
  }
`,m=({connectionId:n,skip:i,shouldFetchPendingSchemaUpdates:o,fetchPolicy:t})=>{const a=T(),l=t?{fetchPolicy:t}:{},{data:e,error:u}=p(b,{client:a??void 0,skip:i||!a,variables:{input:{id:n,shouldFetchPendingSchemaUpdates:o}},...l});return{tables:(e==null?void 0:e.findDistantTablesWithStatus)||[],error:u}};export{r as R,m as u};
