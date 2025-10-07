import{n as i,aP as s,K as S,L as x,a as n,j as t,bF as f,aA as $,bx as v,u as k,h as C,T as h,s as c,t as p,b as m,H as g,B as y,ai as b,bY as R}from"./index-DB0OKRlD.js";import{S as _}from"./SettingsPageContainer-C2QLAmOr.js";import{T as d,a,S as T}from"./Table-cIS0B5sH.js";import{a as j}from"./formatExpiration-rTAMKEyy.js";import{S as w}from"./TableBody-LZo7nNIH.js";import{S as l}from"./TableHeader-DXVgF--L.js";import{S as A}from"./SettingsReadDocumentationButton-B7-t2Z2g.js";import{S as B}from"./SubMenuTopBarContainer-9LB8hreq.js";import"./NeverExpireDeltaInYears-BAM5Jy2K.js";import"./IconBook2-C0wuC9cN.js";const I=i(d)`
  grid-template-columns: 312px auto 28px;
  @media (max-width: ${s}px) {
    width: 100%;
    grid-template-columns: 12fr 4fr;
  }
`,M=i(a)`
  color: ${({theme:e})=>e.font.color.primary};
  gap: ${({theme:e})=>e.spacing(2)};
`,N=i(a)`
  justify-content: center;
  padding-right: ${({theme:e})=>e.spacing(1)};
  padding-left: 0;
`,P=i(S)`
  color: ${({theme:e})=>e.font.color.tertiary};
`,z=({fieldItem:e,to:o})=>{const r=x();return n(I,{to:o,children:[t(M,{children:e.name}),t(a,{color:e.expiration==="Expired"?r.font.color.danger:r.font.color.tertiary,children:e.expiration}),t(N,{children:t(P,{size:r.icon.size.md,stroke:r.icon.stroke.sm})})]})},L=i(w)`
  border-bottom: 1px solid ${({theme:e})=>e.border.color.light};
  @media (max-width: ${s}px) {
    padding-top: ${({theme:e})=>e.spacing(3)};
    display: flex;
    justify-content: space-between;
    scroll-behavior: smooth;
  }
`,D=i(d)`
  grid-template-columns: 312px auto 28px;
  @media (max-width: ${s}px) {
    width: 95%;
    grid-template-columns: 20fr 2fr;
  }
`,K=()=>{const{records:e}=f({objectNameSingular:$.ApiKey,filter:{revokedAt:{is:"NULL"}}});return n(T,{children:[n(D,{children:[t(l,{children:"Name"}),t(l,{children:"Expiration"}),t(l,{})]}),!!e.length&&t(L,{children:j(e).map(o=>t(z,{fieldItem:o,to:`/settings/developers/api-keys/${o.id}`},o.id))})]})},U=i(d)`
  grid-template-columns: 1fr 28px;
`,W=i(a)`
  justify-content: center;
  padding-right: ${({theme:e})=>e.spacing(1)};
  padding-left: 0;
`,E=i(a)`
  color: ${({theme:e})=>e.font.color.primary};
  overflow-x: scroll;
  white-space: nowrap;
`,F=i(S)`
  color: ${({theme:e})=>e.font.color.tertiary};
`,H=({fieldItem:e,to:o})=>{const r=x();return n(U,{to:o,children:[t(E,{children:v(e.targetUrl,{keepPath:!0})}),t(W,{children:t(F,{size:r.icon.size.md,stroke:r.icon.stroke.sm})})]})},O=i(w)`
  border-bottom: 1px solid ${({theme:e})=>e.border.color.light};
  max-height: 260px;
  overflow-y: auto;
`,X=i(d)`
  grid-template-columns: 444px 68px;
`,J=()=>{const{records:e}=f({objectNameSingular:$.Webhook});return n(T,{children:[n(X,{children:[t(l,{children:"Url"}),t(l,{})]}),!!e.length&&t(O,{children:e.map(o=>t(H,{fieldItem:o,to:`/settings/developers/webhooks/${o.id}`},o.id))})]})},u=i.div`
  display: flex;
  justify-content: flex-end;
  padding-top: ${({theme:e})=>e.spacing(2)};
  @media (max-width: ${s}px) {
    padding-top: ${({theme:e})=>e.spacing(5)};
  }
`,q=i.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  gap: ${({theme:e})=>e.spacing(2)};
`,re=()=>{const e=k(),{i18n:o,_:r}=C();return t(B,{title:o._({id:"n+SX4g"}),actionButton:t(A,{}),links:[{children:t(h,{id:"pmUArF"}),href:c(p.Workspace)},{children:t(h,{id:"n+SX4g"})}],children:t(_,{children:n(q,{isMobile:e,children:[n(m,{children:[t(g,{title:o._({id:"5h8ooz"}),description:o._({id:"Mue4oc"})}),t(K,{}),t(u,{children:t(y,{Icon:b,title:o._({id:"uXGLuq"}),size:"small",variant:"secondary",to:c(p.DevelopersNewApiKey)})})]}),n(m,{children:[t(g,{title:o._({id:"v1kQyJ"}),description:o._({id:"JLxMta"})}),t(J,{}),t(u,{children:t(y,{Icon:b,title:o._({id:"dkAPxi"}),size:"small",variant:"secondary",to:c(p.DevelopersNewWebhookDetail,{webhookId:R()},{creationMode:!0})})})]})]})})})};export{re as SettingsDevelopers};
