import{n as u,B as W,_ as B,b9 as X,a as c,j as t,aa as D,N as Y,ab as G,R as y,b3 as _,h as R,V as I,H as L,W as Z,cj as j,b as q,ck as J,as as z,M as b,cl as ee,bg as te,r as V,Y as oe,U as C,bh as ae,cm as ne,aX as se,aY as ie,b2 as re,a1 as le,a2 as de,T as v,s as F,t as x,a5 as ce,cn as A}from"./index-DB0OKRlD.js";import{S as me}from"./SaveAndCancelButtons-Be40PIWS.js";import{S as N,a as E,T as k}from"./Table-cIS0B5sH.js";import{S as T}from"./TableHeader-DXVgF--L.js";import{S as ue}from"./TableBody-LZo7nNIH.js";import{S as pe}from"./SubMenuTopBarContainer-9LB8hreq.js";import{S as be}from"./SettingsPageContainer-C2QLAmOr.js";import"./IconDeviceFloppy-DAyTiaqi.js";const ge=u(N)`
  border-bottom: 1px solid ${({theme:e})=>e.border.color.light};
`,$=u(E)`
  overflow: hidden;
`,w=u(W)`
  -moz-user-select: text;
  -ms-user-select: text;
  -webkit-user-select: text;
  background-color: ${({theme:e})=>e.background.transparent.lighter};
  border: 1px solid ${({theme:e})=>e.border.color.medium};
  border-radius: ${({theme:e})=>e.border.radius.sm};
  color: ${({theme:e})=>e.font.color.tertiary};
  font-family: ${({theme:e})=>e.font.family};
  font-weight: ${({theme:e})=>e.font.weight.regular};
  height: ${({theme:e})=>e.spacing(7)};
  overflow: hidden;
  user-select: text;
  width: 100%;
`,he=({records:e})=>{const{enqueueSnackBar:o}=B(),a=X(n=>{navigator.clipboard.writeText(n),o("Copied to clipboard!",{variant:D.Success})},200);return c(ge,{children:[c(k,{gridAutoColumns:"35% 16% auto",children:[t(T,{children:"Name"}),t(T,{children:"Type"}),t(T,{children:"Value"})]}),t(ue,{children:e.map(n=>c(k,{gridAutoColumns:"30% 16% auto",children:[t($,{children:t(w,{title:n.key,onClick:()=>a(n.key)})}),t($,{children:t(w,{title:n.type.toUpperCase(),onClick:()=>a(n.type.toUpperCase())})}),t($,{children:t(w,{title:n.value,onClick:()=>a(n.value)})})]},n.key))})]})},fe=u(N)`
  background-color: ${({theme:e})=>e.background.transparent.lighter};
  border-radius: ${({theme:e})=>e.border.radius.sm};
  border: 1px solid ${({theme:e})=>e.border.color.light};
`,Se=u(k)`
  display: flex;
  border-bottom: 1px solid ${({theme:e})=>e.border.color.light};
  align-items: center;
  justify-content: space-between;
  &:last-child {
    border-bottom: none;
  }
`,ye=({records:e})=>{const o=e.reduce((r,a)=>(r[a.validationType]={name:r[a.validationType].name,status:a.status,color:a.status==="error"?"red":a.status==="pending"?"yellow":"green"},r),{ssl:{name:"SSL",status:"success",color:"green"},redirection:{name:"Redirection",status:"success",color:"green"},ownership:{name:"Ownership",status:"success",color:"green"}});return t(fe,{children:Object.values(o).map(r=>c(Se,{children:[t(E,{children:r.name}),t(E,{children:t(Y,{color:r.color,text:r.status})})]}))})},Q=G({key:"customDomainRecordsState",defaultValue:null});/* @license Enterprise */const Ce=u.div`
  align-items: center;
  display: flex;
`,De=u.div`
  margin-top: ${({theme:e})=>e.spacing(2)};
`,_e=()=>{const e=y(Q),o=y(_),{i18n:r,_:a}=R(),{control:n}=I();return c(q,{children:[t(L,{title:r._({id:"XQ681Q"}),description:r._({id:"qNbuWB"})}),t(Ce,{children:t(Z,{name:"customDomain",control:n,render:({field:{onChange:l,value:g},fieldState:{error:m}})=>t(j,{value:g,type:"text",onChange:l,error:m==null?void 0:m.message,fullWidth:!0})})}),e&&(o==null?void 0:o.customDomain)&&o.customDomain===(e==null?void 0:e.customDomain)&&c(De,{children:[t(ye,{records:e.records}),t(he,{records:e.records})]})]})},ve=u.div`
  align-items: center;
  display: flex;
`,xe=u.h2`
  align-self: flex-start;
  color: ${({theme:e})=>e.font.color.secondary};
  font-size: ${({theme:e})=>e.font.size.md};
  font-weight: ${({theme:e})=>e.font.weight.medium};
  margin: ${({theme:e})=>e.spacing(2)};
  white-space: nowrap;
`,Te=()=>{const e=y(J),{i18n:o,_:r}=R(),a=y(_),{control:n}=I();return c(q,{children:[t(L,{title:o._({id:"ku9TbG"}),description:o._({id:"tn41zE"})}),t(ve,{children:t(Z,{name:"subdomain",control:n,render:({field:{onChange:l,value:g},fieldState:{error:m}})=>c(z,{children:[t(j,{value:g,type:"text",onChange:l,error:m==null?void 0:m.message,disabled:!!(a!=null&&a.customDomain),fullWidth:!0}),b(e.frontDomain)&&t(xe,{children:`.${e.frontDomain}`})]})})})]})},$e=()=>{const[e,{data:o}]=ee(),r=te(Q),a=y(_),n=V.useCallback(()=>setInterval(async()=>{await e(),b(o==null?void 0:o.checkCustomDomainValidRecords)&&r(o.checkCustomDomainValidRecords)},3e3),[e,o,r]);return V.useEffect(()=>{let l=null;return b(a==null?void 0:a.customDomain)&&(l=n()),()=>{b(l)&&clearInterval(l)}},[a==null?void 0:a.customDomain,n]),t(z,{})},Ae=()=>{const e=oe(),{i18n:o,_:r}=R(),a=C.object({subdomain:C.string().min(3,{message:o._({id:"ZETwlU"})}).max(30,{message:o._({id:"OlC/tU"})}).regex(/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/,{message:o._({id:"oTTQsc"})}),customDomain:C.string().regex(/^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9])$/,{message:o._({id:"qcXnvu"})}).max(256).optional().or(C.literal(""))}).required(),{enqueueSnackBar:n}=B(),[l]=ae(),{redirectToWorkspaceDomain:g}=ne(),m=se(ie.IsCustomDomainEnabled),[s,U]=re(_),p=le({mode:"onChange",delayError:500,defaultValues:{subdomain:(s==null?void 0:s.subdomain)??"",customDomain:(s==null?void 0:s.customDomain)??""},resolver:de(a)}),O=p.watch("subdomain"),M=p.watch("customDomain"),P=(i,h)=>{l({variables:{input:{customDomain:b(i)&&i.length>0?i:null}},onCompleted:()=>{U({...h,customDomain:i&&i.length>0?i:null})},onError:d=>{var f,S;if(d instanceof A&&((S=(f=d.graphQLErrors[0])==null?void 0:f.extensions)==null?void 0:S.code)==="CONFLICT")return p.control.setError("subdomain",{type:"manual",message:o._({id:"omhc+7"})});n(d.message,{variant:D.Error})}})},H=(i,h)=>{l({variables:{input:{subdomain:i}},onError:d=>{var f,S;if(d instanceof A&&((S=(f=d.graphQLErrors[0])==null?void 0:f.extensions)==null?void 0:S.code)==="CONFLICT")return p.control.setError("subdomain",{type:"manual",message:o._({id:"omhc+7"})});n(d.message,{variant:D.Error})},onCompleted:()=>{const d=new URL(window.location.href);d.hostname=new URL(h.workspaceUrls.subdomainUrl).hostname.replace(h.subdomain,i),U({...h,subdomain:i}),g(d.toString())}})},K=async()=>{const i=p.getValues();if(!i||!p.formState.isValid||!s)return n(o._({id:"QdoUFL"}),{variant:D.Error});if(b(i.subdomain)&&i.subdomain!==s.subdomain)return H(i.subdomain,s);if(i.customDomain!==s.customDomain)return P(i.customDomain,s)};return t(pe,{title:o._({id:"EoKe5U"}),links:[{children:t(v,{id:"pmUArF"}),href:F(x.Workspace)},{children:t(v,{id:"Weq9zb"}),href:F(x.Workspace)},{children:t(v,{id:"EoKe5U"})}],actionButton:t(me,{isSaveDisabled:!p.formState.isValid||O===(s==null?void 0:s.subdomain)&&M===(s==null?void 0:s.customDomain),onCancel:()=>e(x.Workspace),onSave:K}),children:t(be,{children:c(ce,{...p,children:[t(Te,{}),m&&c(z,{children:[t($e,{}),t(_e,{})]})]})})})};export{Ae as SettingsDomain};
