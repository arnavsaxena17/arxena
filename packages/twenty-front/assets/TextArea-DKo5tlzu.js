import{n as r,w as g,x as m,r as b,y as $,a as y,j as s,z as w,A as S}from"./index-DB0OKRlD.js";const i=5,k=r.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`,z=r.label`
  color: ${({theme:o})=>o.font.color.light};
  display: block;
  font-size: ${({theme:o})=>o.font.size.xs};
  font-weight: ${({theme:o})=>o.font.weight.semiBold};
  margin-bottom: ${({theme:o})=>o.spacing(1)};
`,v=r(g)`
  background-color: ${({theme:o})=>o.background.transparent.lighter};
  border: 1px solid ${({theme:o})=>o.border.color.medium};
  border-radius: ${({theme:o})=>o.border.radius.sm};
  box-sizing: border-box;
  color: ${({theme:o})=>o.font.color.primary};
  font-family: inherit;
  font-size: ${({theme:o})=>o.font.size.md};
  font-weight: ${({theme:o})=>o.font.weight.regular};
  line-height: 16px;
  overflow: auto;
  padding: ${({theme:o})=>o.spacing(2)};
  resize: none;
  width: 100%;

  &:focus {
    outline: none;
    ${({theme:o})=>`box-shadow: 0px 0px 0px 3px ${m(o.color.blue,.1)};
      border-color: ${o.color.blue};`};
  }

  &::placeholder {
    color: ${({theme:o})=>o.font.color.light};
    font-weight: ${({theme:o})=>o.font.weight.regular};
  }

  &:disabled {
    color: ${({theme:o})=>o.font.color.tertiary};
  }
`,T=({label:o,disabled:l,placeholder:c,minRows:a=1,value:d="",className:p,onChange:e,onBlur:t})=>{const u=Math.min(a,i),n=b.useId(),{goBackToPreviousHotkeyScope:f,setHotkeyScopeAndMemorizePreviousScope:x}=$();return y(k,{children:[o&&s(z,{htmlFor:n,children:o}),s(v,{id:n,placeholder:c,maxRows:i,minRows:u,value:d,onChange:h=>e==null?void 0:e(w(h.target.value)),onFocus:()=>{x(S.TextInput)},onBlur:()=>{f(),t==null||t()},disabled:l,className:p})]})};export{T};
