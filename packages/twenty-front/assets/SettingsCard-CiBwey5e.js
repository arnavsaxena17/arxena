import{n,q as g,f as p,K as h,L as f,j as o,a as r,P as y}from"./index-DB0OKRlD.js";const u=n(g)`
  color: ${({disabled:t,theme:e})=>t?e.font.color.extraLight:e.font.color.tertiary};
  cursor: ${({disabled:t,onClick:e})=>t?"not-allowed":e?"pointer":"default"};
  width: 100%;
  & :hover {
    background-color: ${({theme:t})=>t.background.quaternary};
    cursor: pointer;
  }
`,$=n(p)`
  display: flex;
  flex-direction: column;
  gap: ${({theme:t})=>t.spacing(2)};
  padding: ${({theme:t})=>t.spacing(2,2)};
`,x=n.div`
  align-items: center;
  display: flex;
  gap: ${({theme:t})=>t.spacing(2)};
`,S=n.div`
  color: ${({disabled:t,theme:e})=>t?"inherit":e.font.color.secondary};
  display: flex;
  flex: 1 0 auto;
  font-weight: ${({theme:t})=>t.font.weight.medium};
  gap: ${({theme:t})=>t.spacing(2)};
  justify-content: flex-start;
`,C=n(h)`
  color: ${({theme:t})=>t.font.color.light};
`,m=n.div`
  padding-bottom: ${({theme:t})=>t.spacing(2)};
  padding-left: ${({theme:t})=>t.spacing(7)};
`,v=n.div`
  align-items: center;
  display: flex;
  height: 24px;
  justify-content: center;
  width: 24px;
`,j=({description:t,soon:e,disabled:i=e,Icon:l,onClick:c,title:a,className:d})=>{const s=f();return o(u,{disabled:i,onClick:i?void 0:c,className:d,rounded:!0,children:r($,{children:[r(x,{children:[o(v,{children:l}),r(S,{disabled:i,children:[a,e&&o(y,{label:"Soon"})]}),o(C,{size:s.icon.size.sm})]}),t&&o(m,{children:t})]})})};export{j as S};
