import{v as a,aX as s,aY as t}from"./index-BzerUb1B.js";const p=a`
  fragment RemoteServerFields on RemoteServer {
    id
    createdAt
    foreignDataWrapperId
    foreignDataWrapperOptions
    foreignDataWrapperType
    userMappingOptions {
      user
    }
    updatedAt
    schema
    label
  }
`,i=e=>{switch(e){case"postgresql":return"postgres_fdw";case"stripe":return"stripe_fdw";default:return null}},n=e=>{switch(e){case"airtable":return t.IsAirtableIntegrationEnabled;case"postgresql":return t.IsPostgreSQLIntegrationEnabled;case"stripe":return t.IsStripeIntegrationEnabled;default:return null}},u=e=>{const r=n(e);return s(r)};export{p as D,i as g,u};
