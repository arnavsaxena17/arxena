import{n as r,q as l,f as m,L as p,a as c,j as n,aT as b,ai as S}from"./index-BzerUb1B.js";const x=r(l)`
  background-color: ${({theme:e})=>e.background.secondary};
  height: 40px;
`,C=r(m)`
  align-items: center;
  cursor: ${({onClick:e})=>e?"pointer":"default"};
  display: flex;
  font-size: ${({theme:e})=>e.font.size.sm};
  font-weight: ${({theme:e})=>e.font.weight.medium};
  gap: ${({theme:e})=>e.spacing(2)};
  padding: ${({theme:e})=>e.spacing(2)};
  padding-left: ${({theme:e})=>e.spacing(3)};
  min-height: ${({theme:e})=>e.spacing(6)};
`,z=r.span`
  flex: 1 0 auto;
`,k=({label:e,divider:s,LeftIcon:d,onClick:i,rightComponent:t})=>{const o=p();return c(C,{onClick:i,divider:s,children:[!!d&&n(d,{size:o.icon.size.md}),n(z,{children:e}),t]})},L=r(b)`
  align-items: center;
  display: flex;
  padding: ${({theme:e})=>e.spacing(1)};
`,j=r.button`
  align-items: center;
  background: ${({theme:e})=>e.background.primary};
  border: none;
  border-radius: ${({theme:e})=>e.border.radius.sm};
  color: ${({theme:e})=>e.font.color.secondary};
  gap: ${({theme:e})=>e.spacing(2)};
  padding: 0 ${({theme:e})=>e.spacing(1)};
  padding-left: ${({theme:e})=>e.spacing(2)};
  cursor: pointer;
  display: flex;
  flex: 1 0 0;
  height: ${({theme:e})=>e.spacing(8)};
  width: 100%;

  &:hover {
    background: ${({theme:e})=>e.background.transparent.light};
  }
`,T=({items:e,getItemLabel:s,hasFooter:d,isLoading:i,onRowClick:t,RowIcon:o,RowIconFn:g,RowRightComponent:h,onFooterButtonClick:u,footerButtonLabel:$})=>{const f=p();return i===!0?n(x,{}):c(l,{children:[e.map((a,y)=>n(k,{LeftIcon:g?g(a):o,label:s(a),rightComponent:n(h,{item:a}),divider:y<e.length-1,onClick:()=>t==null?void 0:t(a)},a.id)),d&&n(L,{divider:!!e.length,children:c(j,{onClick:u,children:[n(S,{size:f.icon.size.md}),$]})})]})};export{T as S};
