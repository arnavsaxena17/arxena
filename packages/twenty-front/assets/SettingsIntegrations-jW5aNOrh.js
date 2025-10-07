import{n as o,M as d,aU as m,P as y,a as i,aE as p,j as t,as as g,N as f,ai as h,B as l,aV as S,aW as x,H as k,b as u,h as $,T as a,s as b,t as v}from"./index-BzerUb1B.js";import{S as I}from"./SettingsPageContainer-VijhEKua.js";import{u as w}from"./useSettingsIntegrationCategories-DWlrECe-.js";import{S as _}from"./SubMenuTopBarContainer-DvhK9_Ug.js";const A=o.div`
  align-items: center;
  background: ${({theme:e})=>e.background.secondary};
  border: 1px solid ${({theme:e})=>e.border.color.medium};
  border-radius: ${({theme:e})=>e.border.radius.md};
  font-size: ${({theme:e})=>e.font.size.md};
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: ${({theme:e})=>e.spacing(3)};
  text-decoration: none;
  color: ${({theme:e})=>e.font.color.primary};

  ${({to:e})=>d(e)&&m`
      cursor: pointer;
    `}
`,z=o.div`
  align-items: center;
  display: flex;
  flex-direction: row;
  gap: ${({theme:e})=>e.spacing(3)};
`,P=o.div`
  align-items: center;
  display: flex;
  flex-direction: row;
  gap: ${({theme:e})=>e.spacing(2)};
  color: ${({theme:e})=>e.border.color.strong};
`,U=o(y)`
  padding: ${({theme:e})=>e.spacing(1)} ${({theme:e})=>e.spacing(2)};
`,c=o.img`
  height: 24px;
  width: 24px;
`,j=({integration:e})=>i(A,{to:e.type==="Active"?e.link:void 0,as:e.type==="Active"?p:"div",children:[i(z,{children:[i(P,{children:[t(c,{src:e.from.image,alt:e.from.key}),d(e.to)&&i(g,{children:[t("div",{children:"→"}),t(c,{src:e.to.image,alt:e.to.key})]})]}),e.text]}),e.type==="Soon"?t(U,{label:"Soon"}):e.type==="Active"?t(f,{color:"green",text:"Active"}):e.type==="Add"?t(l,{to:e.link,Icon:h,title:"Add",size:"small"}):e.type==="Use"?t(l,{to:e.link,target:"_blank",Icon:S,title:"Use",size:"small"}):t(l,{to:e.link,target:"_blank",Icon:x,title:e.linkText,size:"small"})]}),C=o.div`
  align-items: start;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`,T=o(p)`
  align-items: start;
  display: flex;
  flex-direction: row;
  font-size: ${({theme:e})=>e.font.size.md};
  gap: ${({theme:e})=>e.spacing(1)};
  cursor: pointer;
  text-decoration: none;
  color: ${({theme:e})=>e.font.color.primary};
`,L=o.div`
  display: flex;
  flex-direction: column;
  gap: ${({theme:e})=>e.spacing(4)};
`,B=({integrationGroup:e})=>i(u,{children:[i(C,{children:[t(k,{title:e.title}),e.hyperlink&&i(T,{target:"_blank",to:e.hyperlink??"",children:[t("div",{children:e.hyperlinkText}),t("div",{children:"→"})]})]}),t(L,{children:e.integrations.map(n=>{var s;return t(j,{integration:n},[e.key,n.from.key,(s=n.to)==null?void 0:s.key].join("-"))})})]}),E=()=>{const{i18n:e,_:n}=$(),s=w();return t(_,{title:e._({id:"nbfdhU"}),links:[{children:t(a,{id:"pmUArF"}),href:b(v.Workspace)},{children:t(a,{id:"nbfdhU"})}],children:t(I,{children:s.map(r=>t(B,{integrationGroup:r},r.key))})})};export{E as SettingsIntegrations};
