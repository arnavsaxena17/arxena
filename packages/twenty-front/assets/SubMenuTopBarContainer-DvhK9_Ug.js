import{n as r,aE as p,L as m,aF as w,D as u,j as n,a as s,aG as d,as as h,u as y,r as $,aH as x,aI as S,aJ as z}from"./index-BzerUb1B.js";const B=r.nav`
  align-items: center;
  color: ${({theme:e})=>e.font.color.tertiary};
  display: grid;
  font-size: ${({theme:e})=>e.font.size.md};
  grid-auto-flow: column;
  grid-column-gap: ${({theme:e})=>e.spacing(1)};
  max-width: 100%;
  min-width: 0;
  height: ${({theme:e})=>e.spacing(8)};
`,v=r(p)`
  color: inherit;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`,g=r.span`
  color: inherit;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`,b=({className:e,links:i})=>{const c=m(),{openSettingsMenu:o}=w(),l=()=>{o()},t=i[i.length-2],f=i.length===2,a=u.isNonEmptyString(t.children)?t.children:"";return n(B,{className:e,children:f?s(h,{children:[n(d,{size:c.icon.size.md}),n(g,{onClick:l,children:"Back to Settings"})]}):t!=null&&t.href?s(h,{children:[n(d,{size:c.icon.size.md}),s(v,{title:a,to:t.href,children:["Back to ",t.children]})]}):n(g,{title:a,children:t==null?void 0:t.children})})},M=r.nav`
  align-items: center;
  color: ${({theme:e})=>e.font.color.tertiary};
  display: grid;
  font-size: ${({theme:e})=>e.font.size.md};
  grid-auto-flow: column;
  grid-column-gap: ${({theme:e})=>e.spacing(1)};
  max-width: 100%;
  min-width: 0;
  height: ${({theme:e})=>e.spacing(8)};
`,T=r(p)`
  color: inherit;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`,C=r.span`
  color: ${({theme:e})=>e.font.color.primary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`,I=r.span`
  width: ${({theme:e})=>e.spacing(2)};
`,j=({className:e,links:i})=>y()&&i.length>0?n(b,{className:e,links:i}):n(M,{className:e,children:i.map((o,l)=>{const t=typeof o.children=="string"?o.children:"";return s($.Fragment,{children:[o.href?n(T,{title:t,to:o.href,children:o.children}):n(C,{title:t,children:o.children}),l<i.length-1&&n(I,{children:"/"})]},l)})}),E=r.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`,F=r.h3`
  color: ${({theme:e})=>e.font.color.primary};
  font-size: ${({theme:e})=>e.font.size.lg};
  font-weight: ${({theme:e})=>e.font.weight.semiBold};
  line-height: 1.2;
  margin: ${({theme:e})=>e.spacing(8,8,2)};
  min-height: ${({theme:e,reserveTitleSpace:i})=>i?e.spacing(5):"none"};
`,D=({children:e,title:i,reserveTitleSpace:c,actionButton:o,className:l,links:t})=>s(E,{className:l,children:[n(x,{title:n(j,{links:t}),children:o}),s(S,{children:[n(z,{}),(i||c)&&n(F,{reserveTitleSpace:c,children:i}),e]})]});export{j as B,D as S};
