import{v as T,aK as p,aM as C,aQ as _,n as g,f as k,j as a,a as d,q as v,as as y,d5 as j,c4 as B,d2 as U,d4 as x,d3 as w,bb as F,bn as P,dU as Q,_ as q,aZ as Y,bk as V,aa as H,e6 as z,r as u,e7 as G,bE as $,e8 as L,aA as A,M as I,B as K,Q as W,b6 as J,U as f,e9 as h,Y as Z,s as R,t as S,H as N}from"./index-BzerUb1B.js";import{S as X}from"./SettingsPageContainer-VijhEKua.js";import{G as ee}from"./findManyDatabaseConnections-Dd5DxXBS.js";import{S as te}from"./SettingsIntegrationDatabaseConnectionSyncStatus-DBAwSv3c.js";import{R as M}from"./useGetDatabaseConnectionTables-DtPWhNbB.js";import{S as ae}from"./SettingsListCard-ThDnU1Wv.js";import{I as ne}from"./IconReload-B2Kf8O4n.js";import{u as oe}from"./useDatabaseConnection-Df4zgdsr.js";import{B as se,S as ie}from"./SubMenuTopBarContainer-DvhK9_Ug.js";import{S as O}from"./index-DX2sgoMh.js";import"./useIsSettingsIntegrationEnabled-QBIf24TO.js";import"./useSettingsIntegrationCategories-DWlrECe-.js";const re=T`
  mutation deleteServer($input: RemoteServerIdInput!) {
    deleteOneRemoteServer(input: $input) {
      id
    }
  }
`,ce=()=>{const e=p(),[t]=C(re,{client:e});return{deleteOneDatabaseConnection:async o=>await t({variables:{input:o},awaitRefetchQueries:!0,refetchQueries:[_(ee)??""]})}},le=g(k)`
  align-items: center;
  display: flex;
  gap: ${({theme:e})=>e.spacing(2)};
  padding: ${({theme:e})=>e.spacing(2)};
  min-height: ${({theme:e})=>e.spacing(6)};
`,de=g.div`
  color: ${({theme:e})=>e.font.color.primary};
  display: flex;
  font-weight: ${({theme:e})=>e.font.weight.medium};
  gap: ${({theme:e})=>e.spacing(2)};
  margin-right: auto;
`,me=({title:e,rightComponent:t})=>a(v,{children:d(le,{children:[a(de,{children:e}),t]})}),ue=g.div`
  align-items: center;
  display: flex;
  height: ${({theme:e})=>e.spacing(4)};
  justify-content: center;
  width: ${({theme:e})=>e.spacing(4)};
`,be=g.img`
  height: 100%;
`,ge=({databaseLogoUrl:e,connectionId:t,connectionLabel:n,onRemove:o})=>{const s="settings-integration-database-connection-summary-card-dropdown";return a(me,{title:d(y,{children:[a(ue,{children:a(be,{alt:"",src:e})}),n]}),rightComponent:d(y,{children:[a(te,{connectionId:t,shouldFetchPendingSchemaUpdates:!0}),a(j,{dropdownId:s,dropdownHotkeyScope:{scope:s},clickableComponent:a(B,{Icon:U,accent:"tertiary"}),dropdownComponents:d(x,{children:[a(w,{LeftIcon:F,text:"Remove",onClick:o}),a(P,{to:"./edit",children:a(w,{LeftIcon:Q,text:"Edit"})})]})})]})})},he=T`
  ${M}
  mutation syncRemoteTable($input: RemoteTableInput!) {
    syncRemoteTable(input: $input) {
      ...RemoteTableFields
    }
  }
`,E=({cache:e,fieldModifiers:t,remoteTableName:n})=>{const o=`RemoteTable:{"name":"${n}"}`;e.modify({id:o,fields:t,optimistic:!0})},D=({skip:e}={})=>{const t=p(),{enqueueSnackBar:n}=q(),{data:o,loading:s,error:l,refetch:r}=Y(z,{client:t??void 0,skip:e||!t,onError:m=>{V("useFindManyObjectMetadataItems error : "+m),n(`${m.message}`,{variant:H.Error})}});return{objectMetadataItems:u.useMemo(()=>G({pagedObjectMetadataItems:o}),[o]),loading:s,error:l,refetch:r}},pe=()=>{const e=p(),t=$(),{refetch:n}=D(),{findManyRecordsQuery:o}=L({objectNameSingular:A.View}),[s]=C(he,{client:e});return{syncRemoteTable:u.useCallback(async r=>{const c=await s({variables:{input:r},update:(m,{data:i})=>{I(i)&&E({cache:m,remoteTableName:r.name,fieldModifiers:{status:()=>i.syncRemoteTable.status}})}});return await n(),await t.query({query:o,fetchPolicy:"network-only"}),c},[t,o,s,n])}},ye=T`
  ${M}
  mutation syncRemoteTableSchemaChanges($input: RemoteTableInput!) {
    syncRemoteTableSchemaChanges(input: $input) {
      ...RemoteTableFields
    }
  }
`,Se=()=>{const e=p(),t=$(),{refetch:n}=D(),{findManyRecordsQuery:o}=L({objectNameSingular:A.View}),[s,l]=C(ye,{client:e});return{syncRemoteTableSchemaChanges:u.useCallback(async c=>{const m=await s({variables:{input:c},update:(i,{data:b})=>{I(b)&&E({cache:i,remoteTableName:c.name,fieldModifiers:{schemaPendingUpdates:()=>b.syncRemoteTableSchemaChanges.schemaPendingUpdates||[],status:()=>b.syncRemoteTableSchemaChanges.status}})}});return await n(),await t.query({query:o,fetchPolicy:"network-only"}),m},[s,n,o,t]),isLoading:l.loading}},Te=T`
  ${M}
  mutation unsyncRemoteTable($input: RemoteTableInput!) {
    unsyncRemoteTable(input: $input) {
      ...RemoteTableFields
    }
  }
`,Ce=()=>{const e=p(),{refetch:t}=D(),[n]=C(Te,{client:e});return{unsyncRemoteTable:u.useCallback(async s=>{const l=await n({variables:{input:s},update:(r,{data:c})=>{I(c)&&E({cache:r,remoteTableName:s.name,fieldModifiers:{status:()=>c.unsyncRemoteTable.status}})}});return await t(),l},[n,t])}},fe=g.h3`
  color: ${({theme:e})=>e.font.color.tertiary};
  font-size: ${({theme:e})=>e.font.size.md};
  font-weight: ${({theme:e})=>e.font.weight.regular};
  margin: 0;
`,Re=({updatesText:e,onUpdate:t})=>d(y,{children:[e&&a(fe,{children:e}),e&&a(K,{Icon:ne,title:"Update",size:"small",onClick:t})]}),Ie=({tableName:e,tableStatus:t,onSyncUpdate:n})=>{const[o,s]=u.useState(!1),l=async r=>{o||(s(!0),await n(r,e),s(!1))};return a(J,{value:t===W.SYNCED,disabled:o,onChange:l})};f.object({syncedTablesByName:f.record(f.boolean())});const Me=g.div`
  align-items: center;
  display: flex;
  gap: ${({theme:e})=>e.spacing(1)};
`,Ee=e=>e.includes(h.TABLE_DELETED)?"Table has been deleted":e.includes(h.COLUMNS_ADDED)&&e.includes(h.COLUMNS_DELETED)?"Columns have been added and other deleted":e.includes(h.COLUMNS_ADDED)?"Columns have been added":e.includes(h.COLUMNS_DELETED)?"Columns have been deleted":null,De=({connectionId:e,tables:t})=>{const{syncRemoteTable:n}=pe(),{unsyncRemoteTable:o}=Ce(),{syncRemoteTableSchemaChanges:s}=Se(),l=t.map(i=>({...i,id:i.name,updatesText:i.schemaPendingUpdates?Ee(i.schemaPendingUpdates):null})),r=u.useCallback(async(i,b)=>{i?await n({remoteServerId:e,name:b}):await o({remoteServerId:e,name:b})},[n,e,o]),c=u.useCallback(async i=>s({remoteServerId:e,name:i}),[s,e]),m=u.useCallback(({item:i})=>d(Me,{children:[i.updatesText&&a(Re,{updatesText:i.updatesText,onUpdate:()=>c(i.name)}),a(Ie,{tableName:i.name,tableStatus:i.status,onSyncUpdate:r})]}),[c,r]);return a(ae,{items:l,RowRightComponent:m,getItemLabel:i=>i.id})},we=()=>{const e=Z(),{connection:t,integration:n,databaseKey:o,tables:s}=oe({fetchPolicy:"network-only"}),{deleteOneDatabaseConnection:l}=ce();if(!t||!n)return null;const r=async()=>{await l({id:t.id}),e(S.IntegrationDatabase,{databaseKey:o})},c=R(S.Integrations);return d(y,{children:[a(se,{links:[{children:"Integrations",href:c},{children:n.text,href:`${c}/${o}`},{children:t.label}]}),d(O,{children:[a(N,{title:"About",description:"About this remote object"}),a(ge,{databaseLogoUrl:n.from.image,connectionId:t.id,connectionLabel:t.label,onRemove:r})]}),d(O,{children:[a(N,{title:"Tables",description:"Select the tables that should be tracked"}),!!(s!=null&&s.length)&&a(De,{connectionId:t.id,tables:s})]})]})},Fe=()=>a(ie,{title:"Database Connection",links:[{children:"Workspace",href:R(S.Workspace)},{children:"Integrations",href:R(S.Integrations)},{children:"Database Connection"}],children:a(X,{children:a(we,{})})});export{Fe as SettingsIntegrationShowDatabaseConnection};
