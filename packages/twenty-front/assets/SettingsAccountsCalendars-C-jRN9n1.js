import{n as o,cb as y,cc as l,j as e,cd as A,b8 as f,aA as p,a as r,H as u,q as v,ce as T,R as E,bW as _,bF as g,cf as I,G as N,as as R,h as w,T as d,s as h,t as S,b as O}from"./index-BzerUb1B.js";import{S as x}from"./SettingsOptionCardContentToggle-DerAz5c8.js";import{S as b}from"./index-DX2sgoMh.js";import{I as j}from"./IconUserPlus-DYPJObtc.js";import"./AvailableTimezoneOptions-AQbVON1E.js";import{S as P}from"./SettingsNewAccountSection-CQ9a7a52.js";import{S as $}from"./SettingsPageContainer-VijhEKua.js";import{S as M}from"./SubMenuTopBarContainer-DvhK9_Ug.js";import"./SettingsAccountsListEmptyStateCard-8B_aECX3.js";const C=o(y)`
  height: ${({theme:t})=>t.spacing(6)};
`,U=[{title:"Everything",description:"The whole event details will be shared with your team.",value:l.SHARE_EVERYTHING,cardMedia:e(C,{subject:"active",body:"active"})},{title:"Metadata",description:"Only date & participants will be shared with your team.",value:l.METADATA,cardMedia:e(C,{subject:"active",body:"inactive"})}],H=({onChange:t,value:i=l.SHARE_EVERYTHING})=>e(A,{name:"event-visibility",options:U,value:i,onChange:t}),L=o.div`
  display: flex;
  flex-direction: column;
  gap: ${({theme:t})=>t.spacing(6)};
`,V=({calendarChannel:t})=>{const{updateOneRecord:i}=f({objectNameSingular:p.CalendarChannel}),c=s=>{i({idToUpdate:t.id,updateOneRecordInput:{visibility:s}})},a=s=>{i({idToUpdate:t.id,updateOneRecordInput:{isContactAutoCreationEnabled:s}})};return r(L,{children:[r(b,{children:[e(u,{title:"Event visibility",description:"Define what will be visible to other users in your workspace"}),e(H,{value:t.visibility,onChange:c})]}),r(b,{children:[e(u,{title:"Contact auto-creation",description:"Automatically create contacts for people you've participated in an event with."}),e(v,{rounded:!0,children:e(x,{Icon:j,title:"Auto-creation",description:"Automatically create contacts for people.",checked:t.isContactAutoCreationEnabled,onChange:()=>{a(!t.isContactAutoCreationEnabled)}})})]})]})};o.div`
  display: flex;
  flex-direction: column;
  gap: ${({theme:t})=>t.spacing(4)};
`;o.div`
  display: flex;
  flex-direction: column;
  gap: ${({theme:t})=>t.spacing(6)};
  padding-top: ${({theme:t})=>t.spacing(6)};
`;const m="settings-account-calendar-channels-tab-list",D=o.div`
  padding-bottom: ${({theme:t})=>t.spacing(6)};
`,F=()=>{const{activeTabId:t}=T(m),i=E(_),{records:c}=g({objectNameSingular:p.ConnectedAccount,filter:{accountOwnerId:{eq:i==null?void 0:i.id}}}),{records:a}=g({objectNameSingular:p.CalendarChannel,filter:{connectedAccountId:{in:c.map(n=>n.id)}},skip:!c.length}),s=[...a.map(n=>({id:n.id,title:n.handle}))];return a.length?r(R,{children:[s.length>1&&e(D,{children:e(I,{tabListInstanceId:m,tabs:s})}),a.map(n=>e(N.Fragment,{children:(a.length===1||n.id===t)&&e(V,{calendarChannel:n})},n.id)),!1]}):e(P,{})},Q=()=>{const{i18n:t,_:i}=w();return e(M,{title:t._({id:"EUpfsd"}),links:[{children:e(d,{id:"7PzzBU"}),href:h(S.ProfilePage)},{children:e(d,{id:"bPwFdf"}),href:h(S.Accounts)},{children:e(d,{id:"EUpfsd"})}],children:e($,{children:e(O,{children:e(F,{})})})})};export{Q as SettingsAccountsCalendars};
