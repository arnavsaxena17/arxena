import{n as o,j as e,L as d,b6 as h,r as $,a as r,as as S}from"./index-DB0OKRlD.js";const f=o.hr`
  border: none;
  border-top: 1px solid ${({theme:t})=>t.border.color.light};
  margin: 0px;
  margin-left: ${({theme:t})=>t.spacing(4)};
  margin-right: ${({theme:t})=>t.spacing(4)};
`,y=()=>e(f,{}),b=o.div`
  align-items: center;
  display: flex;
  gap: ${({theme:t})=>t.spacing(3)};
  background-color: ${({theme:t})=>t.background.secondary};
  padding: ${({theme:t})=>t.spacing(4)};
`,C=o.div`
  align-items: center;
  border: 2px solid ${({theme:t})=>t.border.color.light};
  border-radius: ${({theme:t})=>t.border.radius.sm};
  background-color: ${({theme:t})=>t.background.primary};
  display: flex;
  height: ${({theme:t})=>t.spacing(7)};
  justify-content: center;
  width: ${({theme:t})=>t.spacing(7)};
  min-width: ${({theme:t})=>t.icon.size.md};
`,v=o.div`
  color: ${({theme:t})=>t.font.color.primary};
  font-weight: ${({theme:t})=>t.font.weight.medium};
  margin-bottom: ${({theme:t})=>t.spacing(1)};
`,x=o.div`
  color: ${({theme:t})=>t.font.color.tertiary};
  font-size: ${({theme:t})=>t.font.size.sm};
`,O=o.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transform: scale(${({zoom:t})=>t}) rotate(${({rotate:t})=>t}deg);
`,k=({Icon:t,zoom:i=1,rotate:s=-4})=>{const n=d();return e(O,{zoom:i,rotate:s,children:e(t,{size:n.icon.size.lg,color:n.IllustrationIcon.color.gray,stroke:n.icon.stroke.md})})},z=o(b)`
  cursor: ${({disabled:t})=>t?"default":"pointer"};
  position: relative;
  pointer-events: ${({disabled:t})=>t?"none":"auto"};

  &:hover {
    background: ${({theme:t})=>t.background.transparent.lighter};
  }
`,T=o(h)`
  align-self: ${({toggleCentered:t})=>t?"center":"flex-start"};
  margin-left: auto;
`,w=o.span`
  cursor: pointer;
  inset: 0;
  position: absolute;
`,j=({Icon:t,title:i,description:s,divider:n,disabled:a=!1,advancedMode:g=!1,toggleCentered:p=!0,checked:m,onChange:u})=>{const l=d(),c=$.useId();return r(S,{children:[r(z,{disabled:a,children:[t&&e(C,{children:e(k,{Icon:t})}),r("div",{children:[e(v,{children:r("label",{htmlFor:c,children:[i,e(w,{})]})}),e(x,{children:s})]}),e(T,{id:c,value:m,onChange:u,disabled:a,toggleSize:"small",color:g?l.color.yellow:l.color.blue,toggleCentered:p})]}),n&&e(y,{})]})};export{j as S,k as a,C as b,v as c,x as d,b as e,y as f};
