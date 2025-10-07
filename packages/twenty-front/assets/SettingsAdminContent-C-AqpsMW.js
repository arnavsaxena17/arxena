import{L as Z,a as s,j as t,eb as ae,n as o,K as re,r as T,c4 as oe,ec as le,d0 as ce,a$ as de,as as f,B as V,ed as ue,b as v,ee as R,ef as F,eg as pe,b2 as B,M as C,bf as he,bg as me,eh as ge,cm as Se,ei as be,a3 as ye,R as _,ej as ee,_ as te,be as fe,b3 as Ee,ek as Ie,el as ve,H as b,ad as Ae,b6 as Te,aa as $,ce as ne,em as xe,en as ke,D as Ce,eo as we,dB as Le,X as _e,d6 as $e,cf as se,a_ as P,N as z,aE as Re,s as Fe,t as He,ep as Ne,eq as Ue}from"./index-DB0OKRlD.js";import{a as h,T as g,S as M}from"./Table-cIS0B5sH.js";import{S as y}from"./TableHeader-DXVgF--L.js";import{I as De,a as Ge,b as Oe}from"./IconVariable-Doy9N78M.js";import{S as Pe}from"./SettingsListCard-D5UQeEUm.js";const Ve="https://github.com/twentyhq/twenty",Be=({version:e})=>{const n=Z();return s(ae,{href:Ve,target:"_blank",rel:"noreferrer",children:[t(De,{size:n.icon.size.md}),e]})},G=o(h)`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
`,Me=o.div`
  background-color: ${({theme:e})=>e.background.tertiary};
  border-radius: ${({theme:e})=>e.border.radius.sm};
  margin: ${({theme:e})=>e.spacing(2)} 0;
  padding: ${({theme:e})=>e.spacing(2)};
  border: 1px solid ${({theme:e})=>e.border.color.medium};
  display: grid;
  grid-template-columns: auto 1fr;
  gap: ${({theme:e})=>e.spacing(1)};
  height: fit-content;
  min-height: min-content;
`,O=o.div`
  font-weight: ${({theme:e})=>e.font.weight.medium};
  padding-right: ${({theme:e})=>e.spacing(4)};
`,L=o.div`
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
`,j=o.div`
  word-break: break-word;
  white-space: normal;
  overflow: visible;
`,Ke=o(re)`
  cursor: pointer;
  transform: ${({$isExpanded:e})=>e?"rotate(90deg)":"rotate(0deg)"};
  transition: ${({theme:e})=>`transform ${e.animation.duration.normal}s ease`};
`,We=({variable:e})=>{const[n,d]=T.useState(!1),[a,p]=T.useState(!1),r=Z(),l=e.value===""?"null":e.sensitive&&!a?"••••••":e.value,i=I=>{I.stopPropagation(),p(!a)};return s(f,{children:[s(g,{onClick:()=>d(!n),gridAutoColumns:"4fr 3fr 2fr 1fr 1fr",children:[t(G,{color:"primary",children:t(L,{children:e.name})}),t(G,{children:t(L,{children:e.description})}),t(G,{children:t(L,{children:l})}),t(h,{align:"right",children:e.sensitive&&e.value!==""&&t(oe,{Icon:a?le:ce,size:"small",accent:"secondary",onClick:i})}),t(h,{align:"right",children:t(Ke,{$isExpanded:n,size:r.icon.size.sm})})]}),t(de,{isExpanded:n,mode:"fit-content",children:s(Me,{children:[t(O,{children:"Name:"}),t(L,{children:e.name}),t(O,{children:"Description:"}),t(j,{children:e.description}),t(O,{children:"Value:"}),t(j,{children:l})]})})]})},ze=o(M)`
  margin-top: ${({theme:e})=>e.spacing(3)};
`,q=({variables:e})=>s(ze,{children:[s(g,{gridAutoColumns:"4fr 3fr 2fr 1fr 1fr",children:[t(y,{children:"Name"}),t(y,{children:"Description"}),t(y,{children:"Value"}),t(y,{align:"right"}),t(y,{align:"right"})]}),e.map(n=>t(We,{variable:n},n.name))]}),J=o.div`
  margin-bottom: ${({theme:e})=>e.spacing(6)};
`,Y=o.div`
  background-color: ${({theme:e})=>e.background.secondary};
  border-radius: ${({theme:e})=>e.border.radius.sm};
  border: 1px solid ${({theme:e})=>e.border.color.medium};
  padding-bottom: ${({theme:e})=>e.spacing(2)};
  padding-left: ${({theme:e})=>e.spacing(4)};
  padding-right: ${({theme:e})=>e.spacing(4)};
`,Q=o.div`
  margin-bottom: ${({theme:e})=>e.spacing(4)};
`,je=o.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({theme:e})=>e.spacing(2)};
  margin-bottom: ${({theme:e})=>e.spacing(6)};
`,qe=o(V)`
  ${({isSelected:e,theme:n})=>e&&`
    background-color: ${n.background.transparent.light};
  `}
`,Je=()=>{const{data:e}=ue({fetchPolicy:"network-only"}),[n,d]=T.useState(null),a=i=>{d(n===i?null:i)},p=(e==null?void 0:e.getEnvironmentVariablesGrouped.groups.filter(i=>i.isHiddenOnLoad))??[],r=(e==null?void 0:e.getEnvironmentVariablesGrouped.groups.filter(i=>!i.isHiddenOnLoad))??[],l=e==null?void 0:e.getEnvironmentVariablesGrouped.groups.find(i=>i.name===n);return s(f,{children:[t(v,{children:"These are only the server values. Ensure your worker environment has the same variables and values, this is required for asynchronous tasks like email sync."}),s(v,{children:[r.map(i=>s(J,{children:[t(F,{title:i.name,fontColor:R.Primary}),i.description!==""&&t(Q,{children:i.description}),i.variables.length>0&&t(Y,{children:t(q,{variables:i.variables})})]},i.name)),p.length>0&&s(f,{children:[t(je,{children:p.map(i=>s(qe,{onClick:()=>a(i.name),title:i.name,variant:"secondary",isSelected:n===i.name,children:[i.name," variables"]},i.name))}),l&&s(J,{children:[t(F,{title:l.name,fontColor:R.Primary}),l.description!==""&&t(Q,{children:l.description}),l.variables.length>0&&t(Y,{children:t(q,{variables:l.variables})})]})]})]})]})},K=pe({key:"userLookupResultState",default:null}),Ye=()=>{const[e,n]=B(K);return{updateFeatureFlagState:(a,p,r)=>{C(e)&&n({...e,workspaces:e.workspaces.map(l=>l.id===a?{...l,featureFlags:l.featureFlags.map(i=>i.key===p?{...i,value:r}:i)}:l)})}}},Qe=()=>{const{getAuthTokensFromLoginToken:e}=he(),n=me(ge);return{executeImpersonationAuth:async a=>{n(!0),await e(a),n(!1)}}},Xe=()=>{const{redirectToWorkspaceDomain:e}=Se();return{executeImpersonationRedirect:(d,a)=>e(be(d),ye.Verify,{loginToken:a})}},Ze=o(M)`
  margin-top: ${({theme:e})=>e.spacing(3)};
`,et=({activeWorkspace:e})=>{const n=_(ee),{enqueueSnackBar:d}=te(),[a]=B(fe),p=_(Ee),[r]=Ie(),[l,i]=T.useState(!1),{executeImpersonationAuth:I}=Qe(),{executeImpersonationRedirect:H}=Xe(),[w]=ve(),{updateFeatureFlagState:x}=Ye(),S=_(K),N=async c=>{if(!(S!=null&&S.user.id)){d("Please search for a user first",{variant:$.Error});return}i(!0),await w({variables:{userId:S.user.id,workspaceId:c},onCompleted:async u=>{const{loginToken:E,workspace:m}=u.impersonate;if(m.id===(p==null?void 0:p.id)){await I(E.token);return}return H(m.workspaceUrls,E.token)},onError:u=>{d(`Failed to impersonate user. ${u.message}`,{variant:$.Error})}}).finally(()=>{i(!1)})},U=async(c,u,E)=>{var D,W;const m=(W=(D=S==null?void 0:S.workspaces.find(k=>k.id===c))==null?void 0:D.featureFlags.find(k=>k.key===u))==null?void 0:W.value;x(c,u,E),await r({variables:{workspaceId:c,featureFlag:u,value:E},onError:k=>{C(m)&&x(c,u,m),d(`Failed to update feature flag. ${k.message}`,{variant:$.Error})}})};return e?s(f,{children:[t(b,{title:e.name,description:"Workspace Name"}),t(b,{title:`${e.totalUsers} ${e.totalUsers>1?"Users":"User"}`,description:"Total Users"}),(a==null?void 0:a.canImpersonate)&&t(V,{Icon:Ae,variant:"primary",accent:"blue",title:"Impersonate",onClick:()=>N(e.id),disabled:l||e.allowImpersonation===!1,dataTestId:"impersonate-button"}),n&&s(Ze,{children:[s(g,{gridAutoColumns:"1fr 100px",mobileGridAutoColumns:"1fr 80px",children:[t(y,{children:"Feature Flag"}),t(y,{align:"right",children:"Status"})]}),e.featureFlags.map(c=>s(g,{gridAutoColumns:"1fr 100px",mobileGridAutoColumns:"1fr 80px",children:[t(h,{children:c.key}),t(h,{align:"right",children:t(Te,{value:c.value,onChange:u=>U(e.id,c.key,u)})})]},c.key))]})]}):null},X="settings-admin-user-lookup-workspace-tabs-id",tt="twenty-front",nt="0.42.0-canary",st="module",it={build:"VITE_DISABLE_TYPESCRIPT_CHECKER=true VITE_DISABLE_ESLINT_CHECKER=true NODE_OPTIONS=--max-old-space-size=4000 npx vite build && sh ./scripts/inject-runtime-env.sh","build:sourcemaps":"VITE_BUILD_SOURCEMAP=true VITE_DISABLE_TYPESCRIPT_CHECKER=true VITE_DISABLE_ESLINT_CHECKER=true NODE_OPTIONS=--max-old-space-size=6000 npx vite build && sh ./scripts/inject-runtime-env.sh","start:prod":"NODE_ENV=production npx vite --host",tsup:"npx tsup"},at={node:"^18.17.1",npm:"please-use-yarn",yarn:"^4.0.2"},rt={production:[">0.2%","not dead","not op_mini all"],development:["last 1 chrome version","last 1 firefox version","last 1 safari version"]},ot={workerDirectory:"public"},lt={"@blocknote/xl-docx-exporter":"^0.22.0","@blocknote/xl-pdf-exporter":"^0.22.0","@cyntler/react-doc-viewer":"^1.17.0","@lingui/detect-locale":"^5.2.0","@nivo/calendar":"^0.87.0","@nivo/core":"^0.87.0","@nivo/line":"^0.87.0","@react-pdf/renderer":"^4.1.6","@tiptap/core":"^2.10.4","@tiptap/extension-document":"^2.10.4","@tiptap/extension-hard-break":"^2.10.4","@tiptap/extension-history":"^2.10.4","@tiptap/extension-paragraph":"^2.10.4","@tiptap/extension-placeholder":"^2.10.4","@tiptap/extension-text":"^2.10.4","@tiptap/extension-text-style":"^2.10.4","@tiptap/react":"^2.10.4","@xyflow/react":"^12.4.2",buffer:"^6.0.3",docx:"^9.1.0","file-saver":"^2.0.5","recoil-sync":"^0.2.0",transliteration:"^2.3.5","twenty-shared":"workspace:*"},ct={"@types/file-saver":"^2"},dt={name:tt,version:nt,private:!0,type:st,scripts:it,engines:at,browserslist:rt,msw:ot,dependencies:lt,devDependencies:ct},ut=o.div`
  align-items: center;
  display: flex;
  flex-direction: row;
  gap: ${({theme:e})=>e.spacing(2)};
`,pt=o.div`
  margin-bottom: ${({theme:e})=>e.spacing(5)};
`,ht=o.div`
  align-items: center;
  border-bottom: ${({theme:e})=>`1px solid ${e.border.color.light}`};
  box-sizing: border-box;
  display: flex;
  gap: ${({theme:e})=>e.spacing(2)};
`,mt=o.div`
  flex: 1;
  width: 100%;
  padding: ${({theme:e})=>e.spacing(4)} 0;
`,gt=()=>{const[e,n]=T.useState(""),{enqueueSnackBar:d}=te(),{activeTabId:a,setActiveTabId:p}=ne(X),[r,l]=B(K),[i,I]=T.useState(!1),[H]=xe(),w=_(ee),x=async()=>{var E;p(""),I(!0),l(null);const u=(E=(await H({variables:{userIdentifier:e},onCompleted:m=>{I(!1),C(m==null?void 0:m.userLookupAdminPanel)&&l(m.userLookupAdminPanel)},onError:m=>{I(!1),d(m.message,{variant:$.Error})}})).data)==null?void 0:E.userLookupAdminPanel;C(u==null?void 0:u.workspaces)&&u.workspaces.length>0&&p(u.workspaces[0].id)},S=r==null?void 0:r.workspaces.find(c=>c.id===a),N=(r==null?void 0:r.workspaces.map(c=>({id:c.id,title:c.name,logo:ke({imageUrl:Ce.isNonEmptyString(c.logo)?c.logo:we,baseUrl:Le})??""})))??[],U=`${(r==null?void 0:r.user.firstName)||""} ${(r==null?void 0:r.user.lastName)||""}`.trim();return s(f,{children:[s(v,{children:[t(b,{title:"About",description:"Version of the application"}),t(Be,{version:dt.version})]}),s(v,{children:[t(b,{title:w?"Feature Flags & Impersonation":"User Impersonation",description:w?"Look up users and manage their workspace feature flags or impersonate them.":"Look up users to impersonate them."}),s(ut,{children:[t(_e,{value:e,onChange:n,onInputEnter:x,placeholder:"Enter user ID or email address",fullWidth:!0,disabled:i}),t(V,{Icon:$e,variant:"primary",accent:"blue",title:"Search",onClick:x,disabled:!e.trim()||i})]})]}),C(r)&&s(v,{children:[s(pt,{children:[t(F,{title:"User Info",fontColor:R.Primary}),t(b,{title:U,description:"User Name"}),t(b,{title:r.user.email,description:"User Email"}),t(b,{title:r.user.id,description:"User ID"})]}),t(F,{title:"Workspaces",fontColor:R.Primary}),t(ht,{children:t(se,{tabs:N,tabListInstanceId:X,behaveAsLinks:!1})}),t(mt,{children:t(et,{activeWorkspace:S})})]})]})},St=({details:e})=>{const n=e?JSON.parse(e):null;return n?s(M,{children:[s(g,{children:[t(y,{children:"Status"}),t(y,{align:"right",children:"Count"})]}),s(g,{children:[t(h,{children:"Message Not Synced"}),t(h,{align:"right",children:n.counters.NOT_SYNCED})]}),s(g,{children:[t(h,{children:"Message Sync Ongoing"}),t(h,{align:"right",children:n.counters.ONGOING})]}),s(g,{children:[t(h,{children:"Total Jobs"}),t(h,{align:"right",children:n.totalJobs})]}),s(g,{children:[t(h,{children:"Failed Jobs"}),t(h,{align:"right",children:n.failedJobs})]}),s(g,{children:[t(h,{children:"Failure Rate"}),s(h,{align:"right",children:[n.failureRate,"%"]})]})]}):null},bt=o.div`
  align-items: center;
  display: flex;
  gap: ${({theme:e})=>e.spacing(1)};
`,yt=({service:e})=>s(bt,{children:[e.status===P.OPERATIONAL&&t(z,{color:"green",text:"Operational",weight:"medium"}),e.status===P.OUTAGE&&t(z,{color:"red",text:"Outage",weight:"medium"})]}),ft=o(Re)`
  text-decoration: none;
`,Et=({services:e,loading:n})=>t(f,{children:e.map(d=>t(f,{children:t(ft,{to:Fe(He.AdminPanelIndicatorHealthStatus,{indicatorName:d.id}),children:t(Pe,{items:[d],getItemLabel:a=>a.name,isLoading:n,RowRightComponent:({item:a})=>t(yt,{service:a})})})}))}),It=o.div`
  color: ${({theme:e})=>e.color.red};
  margin-top: ${({theme:e})=>e.spacing(2)};
`,vt=()=>{const{data:e,loading:n}=Ne({fetchPolicy:"network-only"}),d=[{id:"DATABASE",name:"Database Status",...e==null?void 0:e.getSystemHealthStatus.database},{id:"REDIS",name:"Redis Status",...e==null?void 0:e.getSystemHealthStatus.redis},{id:"WORKER",name:"Worker Status",status:e==null?void 0:e.getSystemHealthStatus.worker.status,queues:e==null?void 0:e.getSystemHealthStatus.worker.queues}].filter(p=>!!p.status),a=!(e!=null&&e.getSystemHealthStatus.messageSync.status)||(e==null?void 0:e.getSystemHealthStatus.messageSync.status)===P.OUTAGE;return s(f,{children:[s(v,{children:[t(b,{title:"Health Status",description:"How your system is doing"}),t(Et,{services:d,loading:n})]}),s(v,{children:[t(b,{title:"Message Sync Status",description:"How your message sync is doing"}),a?t(It,{children:(e==null?void 0:e.getSystemHealthStatus.messageSync.details)||"Message sync status is unavailable"}):t(St,{details:e==null?void 0:e.getSystemHealthStatus.messageSync.details})]})]})},A={GENERAL:"general",ENV_VARIABLES:"env-variables",HEALTH_STATUS:"health-status"},ie="settings-admin-tabs-id",At=()=>{const{activeTabId:e}=ne(ie);switch(e){case A.GENERAL:return t(gt,{});case A.ENV_VARIABLES:return t(Je,{});case A.HEALTH_STATUS:return t(vt,{});default:return null}},Tt=o.div`
  align-items: center;
  border-bottom: ${({theme:e})=>`1px solid ${e.border.color.light}`};
  box-sizing: border-box;
  display: flex;
  gap: ${({theme:e})=>e.spacing(2)};
`,_t=()=>{const e=[{id:A.GENERAL,title:"General",Icon:Ge},{id:A.ENV_VARIABLES,title:"Env Variables",Icon:Oe},{id:A.HEALTH_STATUS,title:"Health Status",Icon:Ue}];return s(f,{children:[t(Tt,{children:t(se,{tabs:e,tabListInstanceId:ie,behaveAsLinks:!0})}),t(At,{})]})};export{_t as SettingsAdminContent};
