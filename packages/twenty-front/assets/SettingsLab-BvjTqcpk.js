import{r as m,b2 as F,b3 as b,R as p,b4 as P,b5 as S,M as g,n as h,j as s,a as y,as as L,q as k,s as C,t as f}from"./index-DB0OKRlD.js";import{S as x}from"./SettingsPageContainer-C2QLAmOr.js";import{S as E}from"./SettingsOptionCardContentToggle-BMac9lr7.js";import{S as v}from"./SubMenuTopBarContainer-9LB8hreq.js";const w=()=>{const[r,i]=m.useState(null),[t,o]=F(b),l=p(P),[d]=S({onCompleted:e=>{var a;if(g(t)){const n=e.updateLabPublicFeatureFlag;o({...t,featureFlags:[...((a=t.featureFlags)==null?void 0:a.filter(c=>c.key!==n.key))??[],{...n,workspaceId:t.id}]})}},onError:e=>{i(e.message)}}),u=async(e,a)=>g(t)?(i(null),!!(await d({variables:{input:{publicFeatureFlag:e,value:a}}})).data):(i("No workspace selected"),!1);return{labPublicFeatureFlags:l.map(e=>{var a,n;return{...e,value:((n=(a=t==null?void 0:t.featureFlags)==null?void 0:a.find(c=>c.key===e.key))==null?void 0:n.value)??!1}}),handleLabPublicFeatureFlagUpdate:u,error:r}},I=h.div`
  display: grid;
  gap: ${({theme:r})=>r.spacing(4)};
  grid-template-columns: 1fr;
`,j=h.img`
  border-bottom: 1px solid ${({theme:r})=>r.border.color.medium};
  height: 120px;
  width: 100%;
  object-fit: cover;
  display: flex;
`,_=()=>{const r=p(b),{labPublicFeatureFlags:i,handleLabPublicFeatureFlagUpdate:t}=w(),[o,l]=m.useState({}),d=async(e,a)=>{await t(e,a)},u=e=>{l(a=>({...a,[e]:!0}))};return(r==null?void 0:r.id)&&s(I,{children:[...i].sort((e,a)=>e.metadata.imagePath!==""&&a.metadata.imagePath===""?-1:e.metadata.imagePath===""&&a.metadata.imagePath!==""?1:0).map(e=>y(k,{rounded:!0,children:[e.metadata.imagePath&&!o[e.key]?s(j,{src:e.metadata.imagePath,alt:e.metadata.label,onError:()=>u(e.key)}):s(L,{}),s(E,{title:e.metadata.label,description:e.metadata.description,checked:e.value,onChange:a=>d(e.key,a),toggleCentered:!1})]},e.key))})},O=()=>s(v,{title:"Lab",links:[{children:"Other",href:C(f.Lab)},{children:"Lab"}],children:s(x,{children:s(_,{})})});export{O as SettingsLab};
