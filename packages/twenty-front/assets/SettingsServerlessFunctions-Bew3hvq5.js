import{n as o,K as h,L as y,a as s,j as e,bO as b,bP as g,bQ as T,bR as F,bS as f,B as d,ai as S,s as i,t as l,bT as C,aK as v,aZ as R,as as E,bn as N,b as x}from"./index-BzerUb1B.js";import{S as I}from"./SettingsPageContainer-VijhEKua.js";import{T as m,a as u,S as P}from"./Table-_VNdQp1e.js";import{F as w}from"./findManyServerlessFunctions-UJbX11hF.js";import{S as A}from"./TableBody-M9Ou8IjE.js";import{S as a}from"./TableHeader-BaKK11nR.js";import{S as M}from"./SubMenuTopBarContainer-DvhK9_Ug.js";import"./serverlessFunctionFragment-D0CsKo3J.js";const k=o(m)`
  grid-template-columns: 312px 132px 68px;
`,c=o(u)`
  color: ${({theme:t})=>t.font.color.primary};
  gap: ${({theme:t})=>t.spacing(2)};
`,B=o(u)`
  justify-content: center;
  padding-right: ${({theme:t})=>t.spacing(1)};
`,_=o(h)`
  color: ${({theme:t})=>t.font.color.tertiary};
`,$=({serverlessFunction:t,to:n})=>{const r=y();return s(k,{to:n,children:[e(c,{children:t.name}),e(c,{children:t.runtime}),e(B,{children:e(_,{size:r.icon.size.md,stroke:r.icon.stroke.sm})})]})},L=o.div`
  height: 60vh;
`,O=()=>e(L,{children:s(C,{...b,children:[e(g,{type:"emptyFunctions"}),s(T,{children:[e(F,{children:"Add your first Function"}),e(f,{children:"Add your first Function to get started"})]}),e(d,{Icon:S,title:"New function",to:i(l.NewServerlessFunction)})]})}),j=()=>{const t=v(),{data:n,loading:r,error:p}=R(w,{client:t??void 0});return{serverlessFunctions:(n==null?void 0:n.findManyServerlessFunctions)||[],loading:r,error:p}},z=o(m)`
  grid-template-columns: 312px 132px 68px;
`,D=o(A)`
  border-bottom: 1px solid ${({theme:t})=>t.border.color.light};
`,H=()=>{const{serverlessFunctions:t}=j();return e(E,{children:t.length?e(I,{children:s(P,{children:[s(z,{children:[e(a,{children:"Name"}),e(a,{children:"Runtime"}),e(a,{})]}),e(D,{children:t.map(n=>e($,{serverlessFunction:n,to:i(l.ServerlessFunctions,{id:n.id})},n.id))})]})}):e(O,{})})},q=()=>e(M,{title:"Functions",actionButton:e(N,{to:i(l.NewServerlessFunction),children:e(d,{Icon:S,title:"New Function",accent:"blue",size:"small"})}),links:[{children:"Workspace",href:i(l.Workspace)},{children:"Functions"}],children:e(x,{children:e(H,{})})});export{q as SettingsServerlessFunctions};
