import{n as d,f as re,dA as ne,L as E,a as c,j as t,V as U,_ as B,b as w,H as O,X as m,B as b,b7 as y,aa as h,W as P,as as J,dB as A,U as l,r as Q,dC as ie,dD as oe,dE as ae,dF as se,M as z,dG as N,dc as F,dH as ce,dI as le,bg as de,bY as ue,Y as pe,a1 as Se,a2 as me,t as $,s as j,a5 as ye,a9 as ge}from"./index-BzerUb1B.js";import{S as fe}from"./SaveAndCancelButtons-t1Yndyjc.js";import{S as he}from"./SettingsPageContainer-VijhEKua.js";import{S as Ce}from"./SSOIdentitiesProvidersState-W9xNs_jl.js";import{S as ve}from"./SubMenuTopBarContainer-DvhK9_Ug.js";import"./IconDeviceFloppy-Dqs9eNjb.js";const Ie=d(re)`
  display: flex;
  align-items: center;
  padding: ${({theme:e})=>e.spacing(2)};
  border: 1px solid ${({theme:e})=>e.border.color.medium};
  border-radius: ${({theme:e})=>e.border.radius.sm};
  flex-grow: 1;
  gap: ${({theme:e})=>e.spacing(2)};
  cursor: pointer;

  &:hover {
    background: ${({theme:e})=>e.background.transparent.lighter};
  }
`,be=d(ne)`
  margin-left: auto;
  padding: ${({theme:e})=>e.spacing(1)};
`,we=d.div`
  color: ${({theme:e})=>e.font.color.secondary};
  font-weight: ${({theme:e})=>e.font.weight.medium};
`,Oe=d.div`
  color: ${({theme:e})=>e.font.color.tertiary};
  font-size: ${({theme:e})=>e.font.size.sm};
`,De=({value:e,handleClick:i,title:n,description:r,isSelected:s,Icon:o})=>{const a=E();return c(Ie,{onClick:()=>i(e),children:[o&&t(o,{size:a.icon.size.xl,color:a.color.gray50}),c("span",{children:[n&&t(we,{children:n}),r&&t(Oe,{children:r})]}),t(be,{value:e,checked:s})]})},Pe=d.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({theme:e})=>e.spacing(4)};
`,xe=({options:e,value:i,onChange:n})=>t(Pe,{children:e.map(r=>t(De,{value:r.value,isSelected:i===r.value,handleClick:n,title:r.title,description:r.description,Icon:r.Icon},r.value))});/* @license Enterprise */const V=d.div`
  display: flex;
  flex-direction: column;
  gap: ${({theme:e})=>e.spacing(2,4)};
  width: 100%;
`,W=d.div`
  display: flex;
  flex-direction: row;
`,X=d.div`
  flex: 1;
  margin-right: ${({theme:e})=>e.spacing(2)};
`,K=d.div`
  align-items: end;
  display: flex;
`,Me=()=>{const{control:e}=U(),{enqueueSnackBar:i}=B(),n=E(),r=window.location.origin,s=`${A}/auth/oidc/callback`;return c(J,{children:[c(w,{children:[t(O,{title:"Client Settings",description:"Provide your OIDC provider details"}),c(V,{children:[c(W,{children:[t(X,{children:t(m,{readOnly:!0,label:"Authorized URI",value:r,fullWidth:!0})}),t(K,{children:t(b,{Icon:y,title:"Copy",onClick:()=>{i("Authorized Url copied to clipboard",{variant:h.Success,icon:t(y,{size:n.icon.size.md}),duration:2e3}),navigator.clipboard.writeText(r)}})})]}),c(W,{children:[t(X,{children:t(m,{readOnly:!0,label:"Redirection URI",value:s,fullWidth:!0})}),t(K,{children:t(b,{Icon:y,title:"Copy",onClick:()=>{i("Redirect Url copied to clipboard",{variant:h.Success,icon:t(y,{size:n.icon.size.md}),duration:2e3}),navigator.clipboard.writeText(s)}})})]})]})]}),c(w,{children:[t(O,{title:"Identity Provider",description:"Enter the credentials to set the connection"}),c(V,{children:[t(P,{name:"clientID",control:e,render:({field:{onChange:o,value:a}})=>t(m,{autoComplete:"off",label:"Client ID",value:a,onChange:o,fullWidth:!0,placeholder:"900960562328-36306ohbk8e3.apps.googleusercontent.com"})}),t(P,{name:"clientSecret",control:e,render:({field:{onChange:o,value:a}})=>t(m,{autoComplete:"off",type:"password",label:"Client Secret",value:a,onChange:o,fullWidth:!0,placeholder:"****************************"})}),t(P,{name:"issuer",control:e,render:({field:{onChange:o,value:a}})=>t(m,{autoComplete:"off",label:"Issuer URI",value:a,onChange:o,fullWidth:!0,placeholder:"https://accounts.google.com"})})]})]})]})};/* @license Enterprise */const $e=l.object({entityID:l.string().url(),ssoUrl:l.string().url(),certificate:l.string().min(1)}),Z=["md","ns0","ns2","dsig","ds"],f=(e,i,n=[...Z])=>{var r,s;if(n.length!==0)return((r=e.getElementsByTagName(`${n[0]}:${i}`))==null?void 0:r[0])??f(e,i,n.slice(1))??((s=e.getElementsByTagName(i))==null?void 0:s[0])},ee=(e,i,n=[...Z])=>{const r=e.getElementsByTagName(`${n[0]}:${i}`);return r.length!==0?Array.from(r):n.length>0?ee(e,i,n.slice(1)):Array.from(e.getElementsByTagName(`${i}`))},Ae=e=>{var i,n,r;try{const o=new DOMParser().parseFromString(e,"application/xml");if(o.getElementsByTagName("parsererror").length>0)throw new Error("Error parsing XML");const a=f(o,"EntityDescriptor");if(!a)throw new Error("No EntityDescriptor found");const p=f(o,"IDPSSODescriptor");if(!p)throw new Error("No IDPSSODescriptor found");const S=f(p,"KeyDescriptor");if(!S)throw new Error("No KeyDescriptor found");const g=f(S,"KeyInfo");if(!g)throw new Error("No KeyInfo found");const x=f(g,"X509Data");if(!x)throw new Error("No X509Data found");const M=(n=(i=f(x,"X509Certificate"))==null?void 0:i.textContent)==null?void 0:n.trim();if(!M)throw new Error("No X509Certificate found");const L={ssoUrl:(r=ee(p,"SingleSignOnService").map(C=>({Binding:C.getAttribute("Binding"),Location:C.getAttribute("Location")})).find(C=>C.Binding==="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"))==null?void 0:r.Location,certificate:M,entityID:a==null?void 0:a.getAttribute("entityID")};return{success:!0,data:$e.parse(L)}}catch(s){return{success:!1,error:s}}};/* @license Enterprise */const Le=d.div`
  align-items: center;
  display: flex;
  gap: ${({theme:e})=>e.spacing(2)};
`,ke=d.input`
  display: none;
`,Ee=d.div`
  display: flex;
  flex-direction: column;
  gap: ${({theme:e})=>e.spacing(2,4)};
  width: 100%;
`,k=d.div`
  display: flex;
  flex-direction: row;
`,_=d.div`
  flex: 1;
  margin-right: ${({theme:e})=>e.spacing(2)};
`,q=d.div`
  align-items: end;
  display: flex;
`,Ue=()=>{const{enqueueSnackBar:e}=B(),i=E(),{setValue:n,getValues:r,watch:s,trigger:o}=U(),a=async u=>{if(z(u.target.files)){const v=await u.target.files[0].text(),I=Ae(v);if(u.target.value="",!I.success)return e("Invalid File",{variant:h.Error,duration:2e3});n("ssoURL",I.data.ssoUrl),n("certificate",I.data.certificate),n("issuer",I.data.entityID),o()}},p=`${A}/auth/saml/login/${r("id")}`,S=`${A}/auth/saml/callback/${r("id")}`,g=Q.useRef(null),x=()=>{var u,v;(v=(u=g==null?void 0:g.current)==null?void 0:u.click)==null||v.call(u)},M=s("ssoURL"),R=s("certificate"),L=s("issuer"),C=()=>[M,R,L].every(u=>z(u)&&u.length>0),te=async()=>{const u=await fetch(`${A}/auth/saml/metadata/${r("id")}`);if(!u.ok)return e("Metadata file generation failed",{variant:h.Error,duration:2e3});const v=await u.text(),I=new Blob([v],{type:"application/xml"}),T=URL.createObjectURL(I),D=document.createElement("a");D.href=T,D.download="metadata.xml",document.body.appendChild(D),D.click(),document.body.removeChild(D),URL.revokeObjectURL(T)};return c(J,{children:[c(w,{children:[t(O,{title:"Identity Provider Metadata XML",description:"Upload the XML file with your connection infos"}),c(Le,{children:[t(ke,{ref:g,onChange:a,type:"file",accept:".xml"}),t(b,{Icon:ie,onClick:x,title:"Upload file"}),C()&&t(oe,{size:i.icon.size.md,stroke:i.icon.stroke.lg,color:i.color.blue})]})]}),c(w,{children:[t(O,{title:"Service Provider Details",description:"Enter the infos to set the connection"}),c(Ee,{children:[t(k,{children:t(b,{Icon:ae,onClick:te,title:"Download file"})}),t(se,{text:"Or"}),c(k,{children:[t(_,{children:t(m,{disabled:!0,label:"ACS Url",value:S,fullWidth:!0})}),t(q,{children:t(b,{Icon:y,title:"Copy",onClick:()=>{e("ACS Url copied to clipboard",{variant:h.Success,icon:t(y,{size:i.icon.size.md}),duration:2e3}),navigator.clipboard.writeText(S)}})})]}),c(k,{children:[t(_,{children:t(m,{disabled:!0,label:"Entity ID",value:p,fullWidth:!0})}),t(q,{children:t(b,{Icon:y,title:"Copy",onClick:()=>{e("Entity ID copied to clipboard",{variant:h.Success,icon:t(y,{size:i.icon.size.md}),duration:2e3}),navigator.clipboard.writeText(p)}})})]})]})]})]})};/* @license Enterprise */const H=d.div`
  display: grid;
  gap: ${({theme:e})=>e.spacing(2,4)};
  grid-template-columns: 1fr 1fr;
  grid-template-areas: 'input-1 input-1';

  & :first-of-type {
    grid-area: input-1;
  }
`,Be=()=>{const{control:e,watch:i}=U(),n={OIDC:{option:{Icon:F,title:"OIDC",value:"OIDC",description:""},form:t(Me,{})},SAML:{option:{Icon:F,title:"SAML",value:"SAML",description:""},form:t(Ue,{})}},r=i("type"),s=Q.useMemo(()=>{switch(r){case N.OIDC:return n.OIDC.form;case N.SAML:return n.SAML.form;default:return null}},[n.OIDC.form,n.SAML.form,r]);return c(he,{children:[c(w,{children:[t(O,{title:"Name",description:"The name of your connection"}),t(H,{children:t(P,{name:"name",control:e,render:({field:{onChange:o,value:a}})=>t(m,{autoComplete:"off",label:"Name",value:a,onChange:o,fullWidth:!0,placeholder:"Google OIDC"})})})]}),c(w,{children:[t(O,{title:"Type",description:"Choose between OIDC and SAML protocols"}),t(H,{children:t(P,{name:"type",control:e,render:({field:{onChange:o,value:a}})=>t(xe,{value:a,options:Object.values(n).map(p=>p.option),onChange:o})})})]}),s]})};/* @license Enterprise */const Re=()=>{const[e]=ce(),[i]=le(),n=de(Ce);return{createSSOIdentityProvider:async s=>{if(s.type==="OIDC"){const{type:o,...a}=s;return await e({variables:{input:a},onCompleted:p=>{n(S=>[...S,p.createOIDCIdentityProvider])}})}else if(s.type==="SAML"){const{type:o,...a}=s;return await i({variables:{input:a},onCompleted:p=>{n(S=>[...S,p.createSAMLIdentityProvider])}})}else throw new Error("Invalid IdpType")}}};/* @license Enterprise */const G={SAML:()=>({type:"SAML",ssoURL:"",name:"",id:ue(),certificate:"",issuer:""}),OIDC:()=>({type:"OIDC",name:"",clientID:"",clientSecret:"",issuer:""})};/* @license Enterprise */const Te=l.object({type:l.literal("OIDC"),clientID:l.string().nonempty(),clientSecret:l.string().nonempty()}).required(),ze=l.object({type:l.literal("SAML"),id:l.string().nonempty(),ssoURL:l.string().url().nonempty(),certificate:l.string().nonempty()}).required(),Y=l.discriminatedUnion("type",[Te,ze]).and(l.object({name:l.string().nonempty(),issuer:l.string().url().nonempty()}).required());/* @license Enterprise */const Ke=()=>{const e=pe(),{enqueueSnackBar:i}=B(),{createSSOIdentityProvider:n}=Re(),r=Se({mode:"onChange",resolver:me(Y),defaultValues:Object.values(G).reduce((o,a)=>({...o,...a()}),{})}),s=async()=>{try{const o=r.getValues("type");await n(Y.parse(ge(r.getValues(),Object.keys(G[o]())))),e($.Security)}catch(o){i(o.message,{variant:h.Error})}};return t(ve,{title:"New SSO Configuration",actionButton:t(fe,{isSaveDisabled:!r.formState.isValid,onCancel:()=>e($.Security),onSave:s}),links:[{children:"Workspace",href:j($.Workspace)},{children:"Security",href:j($.Security)},{children:"New"}],children:t(ye,{...r,children:t(Be,{})})})};export{Ke as SettingsSecuritySSOIdentifyProvider};
