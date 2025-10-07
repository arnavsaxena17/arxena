import{v as g,aK as d,aZ as m,$ as A,Z as f,r as C,a3 as I}from"./index-DB0OKRlD.js";import{D as b,g as E,u as v}from"./useIsSettingsIntegrationEnabled-GkLBa4L6.js";import{u as D}from"./useGetDatabaseConnectionTables-BZl1l-vh.js";import{u as N}from"./useSettingsIntegrationCategories-7oDC7PjT.js";const T=g`
  ${b}
  query GetOneDatabaseConnection($input: RemoteServerIdInput!) {
    findOneRemoteServerById(input: $input) {
      ...RemoteServerFields
    }
  }
`,O=({databaseKey:i,connectionId:e,skip:r,fetchPolicy:s})=>{const p=d(),a=E(i),u=s?{fetchPolicy:s}:{},{data:t,loading:o}=m(T,{client:p??void 0,skip:r||!p||!a,variables:{input:{id:e}},...u}),n=(t==null?void 0:t.findOneRemoteServerById)??null;return{connection:(n==null?void 0:n.foreignDataWrapperType)===a?n:null,loading:o}},R=({fetchPolicy:i})=>{const{databaseKey:e="",connectionId:r=""}=A(),s=f(),[p]=N(),a=p.integrations.find(({from:{key:l}})=>l===e),u=v(e),t=!!a&&u,{connection:o,loading:n}=O({databaseKey:e,connectionId:r,skip:!t,fetchPolicy:i});C.useEffect(()=>{(!t||!n&&!o)&&s(I.NotFound)},[a,e,s,t,o,n]);const{tables:c}=D({connectionId:r,skip:!o,shouldFetchPendingSchemaUpdates:!0,fetchPolicy:i});return{connection:o,integration:a,databaseKey:e,tables:c}};export{R as u};
