import{n as a,j as n,a as s,N as p,a_ as o,as as y,a$ as x,B as H,h as C,$ as E,b0 as O,r as T,s as u,t as g,b as m,H as f,b1 as h}from"./index-BzerUb1B.js";import{S as P}from"./SettingsListCard-ThDnU1Wv.js";import{T as k,S as v,a as l}from"./Table-_VNdQp1e.js";import{S as Q}from"./SettingsPageContainer-VijhEKua.js";import{S as R}from"./SubMenuTopBarContainer-DvhK9_Ug.js";const _=a.div`
  border: 1px solid ${({theme:t})=>t.border.color.medium};
  border-radius: ${({theme:t})=>t.border.radius.sm};
  padding-top: ${({theme:t})=>t.spacing(1)};
  padding-bottom: ${({theme:t})=>t.spacing(3)};
  padding-left: ${({theme:t})=>t.spacing(3)};
  padding-right: ${({theme:t})=>t.spacing(3)};
`,B=a.div`
  margin-bottom: ${({theme:t})=>t.spacing(3)};
  margin-top: ${({theme:t})=>t.spacing(5)};
`,$=a(k)`
  height: ${({theme:t})=>t.spacing(6)};
`,L=a.div`
  color: ${({theme:t})=>t.font.color.primary};
  font-size: ${({theme:t})=>t.font.size.sm};
  font-weight: ${({theme:t})=>t.font.weight.medium};
  margin-bottom: ${({theme:t})=>t.spacing(3)};
  padding-left: ${({theme:t})=>t.spacing(3)};
`,D=({queues:t,selectedQueue:r})=>{const i=t.find(e=>e.name===r);return n(x,{isExpanded:!!r,mode:"fit-content",children:i&&s(y,{children:[n(B,{children:n(P,{items:[{...i,id:i.name}],getItemLabel:e=>e.name,isLoading:!1,RowRightComponent:({item:e})=>n(p,{color:e.status===o.OPERATIONAL?"green":"red",text:e.status.toLowerCase(),weight:"medium"})})}),n(L,{children:" Metrics:"}),n(_,{children:s(v,{children:[s($,{children:[n(l,{align:"left",children:"Workers"}),n(l,{align:"right",children:i.workers})]}),Object.entries(i.metrics).filter(([e])=>e!=="__typename").map(([e,d])=>s($,{children:[n(l,{align:"left",children:e.charAt(0).toUpperCase()+e.slice(1)}),n(l,{align:"right",children:d})]},e))]})})]})})},N=a.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({theme:t})=>t.spacing(2)};
  margin-top: ${({theme:t})=>t.spacing(6)};
`,j=a(H)`
  ${({isSelected:t,theme:r,status:i})=>t&&`
    background-color: ${i===o.OPERATIONAL?r.tag.background.green:r.tag.background.red};
  `}
`,z=({queues:t,selectedQueue:r,toggleQueueVisibility:i})=>n(N,{children:t.map(e=>n(j,{onClick:()=>i(e.name),title:e.name,variant:"secondary",isSelected:r===e.name,status:e.status},e.name))}),M=a.div``,G=a.div`
  display: flex;
  flex-direction: column;
  flex: 1;
`,U=a.div`
  color: ${({theme:t})=>t.color.red};
  margin-top: ${({theme:t})=>t.spacing(2)};
`,W=a.pre`
  background-color: ${({theme:t})=>t.background.quaternary};
  padding: ${({theme:t})=>t.spacing(6)};
  border-radius: ${({theme:t})=>t.border.radius.sm};
  white-space: pre-wrap;
  font-size: ${({theme:t})=>t.font.size.sm};
`,q=()=>{const{i18n:t,_:r}=C(),{indicatorName:i}=E(),{data:e,loading:d}=O({variables:{indicatorName:i}}),S=e!=null&&e.getIndicatorHealthStatus.details?JSON.stringify(JSON.parse(e.getIndicatorHealthStatus.details),null,2):null,A=!(e!=null&&e.getIndicatorHealthStatus.status)||(e==null?void 0:e.getIndicatorHealthStatus.status)===o.OUTAGE,[c,I]=T.useState(null),w=b=>{I(c===b?null:b)};return n(R,{links:[{children:t._({id:"/IX/7x"}),href:u(g.AdminPanel)},{children:t._({id:"yy5k7a"}),href:u(g.AdminPanel)},{children:t._({id:"I1IOmb"}),href:u(g.AdminPanelHealthStatus)},{children:`${i}`}],children:s(Q,{children:[s(m,{children:[n(f,{title:`${i}`,description:"Health status"}),s(M,{children:[(e==null?void 0:e.getIndicatorHealthStatus.status)===o.OPERATIONAL&&n(p,{color:"green",text:"Operational",weight:"medium"}),(e==null?void 0:e.getIndicatorHealthStatus.status)===o.OUTAGE&&n(p,{color:"red",text:"Outage",weight:"medium"})]})]}),i===h.WORKER?s(m,{children:[n(G,{children:n(f,{title:"Queue Status",description:"Background job processing status and metrics"})}),A&&!d?n(U,{children:"Queue information is not available because the worker is down"}):s(y,{children:[n(z,{queues:(e==null?void 0:e.getIndicatorHealthStatus.queues)??[],selectedQueue:c,toggleQueueVisibility:w}),n(D,{queues:(e==null?void 0:e.getIndicatorHealthStatus.queues)??[],selectedQueue:c})]})]}):null,i===h.DATABASE||i===h.REDIS?n(m,{children:S&&n(W,{children:S})}):null]})})};export{q as SettingsAdminIndicatorHealthStatus};
