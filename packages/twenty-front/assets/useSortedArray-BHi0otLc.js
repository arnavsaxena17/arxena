import{U as N}from"./mutations-gCIfaPsk.js";import{aK as x,aM as F,aL as C,C as w,b2 as B,a as y,j as i,bK as b,bL as S,n as f,L as I,r as A,bM as O,bN as $,as as z,R as D,M as g}from"./index-BzerUb1B.js";import{S as L}from"./TableHeader-BaKK11nR.js";import{S as M}from"./TableBody-M9Ou8IjE.js";const K=()=>{const e=x(),[s,{loading:l}]=F(N,{client:e??void 0}),{refreshObjectMetadataItems:o}=C("network-only");return{updateOneObjectMetadataItem:async({idToUpdate:r,updatePayload:t})=>{const c=await s({variables:{idToUpdate:r,updatePayload:t}});return await o(),c},loading:l}},T=w({key:"sortedFieldByTableFamilyState",defaultValue:null}),J=({tableId:e,fieldName:s,label:l,align:o="left",initialSort:u,Icon:r})=>{const[t,c]=B(T({tableId:e})),a=t??u,m=(a==null?void 0:a.fieldName)===s,n=m?a.orderBy:null,d=n==="AscNullsLast"||n==="AscNullsFirst",p=d||(n==="DescNullsLast"||n==="DescNullsFirst");return y(L,{align:o,onClick:()=>{c({fieldName:s,orderBy:m?a.orderBy==="AscNullsLast"?"DescNullsLast":"AscNullsLast":"DescNullsLast"})},children:[p&&o==="right"?d?i(b,{size:"14"}):i(S,{size:"14"}):null,r&&i(r,{size:14}),l,p&&o==="left"?d?i(b,{size:"14"}):i(S,{size:"14"}):null]})},j=f.div`
  align-items: center;
  background-color: ${({theme:e})=>e.background.transparent.lighter};
  border-bottom: 1px solid ${({theme:e})=>e.border.color.light};
  color: ${({theme:e})=>e.font.color.light};
  cursor: pointer;
  display: flex;
  font-size: ${({theme:e})=>e.font.size.xs};
  font-weight: ${({theme:e})=>e.font.weight.semiBold};
  height: ${({theme:e})=>e.spacing(6)};
  justify-content: space-between;
  padding: 0 ${({theme:e})=>e.spacing(2)};
  text-align: left;
  text-transform: uppercase;
`,k=f.div`
  max-height: ${({isExpanded:e})=>e?"fit-content":0};
  opacity: ${({isExpanded:e})=>e?1:0};
  overflow: hidden;
  transition:
    max-height ${({theme:e})=>e.animation.duration.normal}s,
    opacity ${({theme:e})=>e.animation.duration.normal}s;
`,v=f(M)`
  border-bottom: 1px solid ${({theme:e})=>e.border.color.light};
`,P=({children:e,isInitiallyExpanded:s=!0,title:l})=>{const o=I(),[u,r]=A.useState(s);return y(z,{children:[y(j,{isExpanded:u,onClick:()=>r(c=>!c),children:[l,u?i(O,{size:o.icon.size.sm}):i($,{size:o.icon.size.sm})]}),i(k,{isExpanded:u,children:i(v,{children:e})})]})},V=(e,s)=>{const l=D(T({tableId:s.tableId})),o=s.initialSort;return A.useMemo(()=>{var m;const r=g(l)?l:o;if(!g(r))return e;const t=r.fieldName,c=(m=s.fields.find(n=>n.fieldName===t))==null?void 0:m.fieldType,a=r.orderBy;return[...e].sort((n,d)=>{var h,p;return c==="string"?a==="AscNullsLast"||a==="AscNullsFirst"?(h=n[t])==null?void 0:h.localeCompare(d[t]):(p=d[t])==null?void 0:p.localeCompare(n[t]):c==="number"?a==="AscNullsLast"||a==="AscNullsFirst"?n[t]-d[t]:d[t]-n[t]:0})},[e,s,o,l])};export{J as S,P as T,V as a,K as u};
