import{h as s,j as e,aN as o,B as c,n as l,a as r}from"./index-BzerUb1B.js";import{I as d}from"./IconDeviceFloppy-Dqs9eNjb.js";const u=({onCancel:t,disabled:n=!1})=>{const{i18n:a,_:i}=s();return e(o,{title:a._({id:"dEgA5A"}),accent:"tertiary",onClick:t,disabled:n})},p=({onSave:t,disabled:n})=>e(c,{title:"Save",variant:"primary",size:"small",accent:"blue",disabled:n,onClick:t,Icon:d}),m=l.div`
  align-items: center;
  display: flex;
  gap: ${({theme:t})=>t.spacing(1)};
`,y=({onSave:t,onCancel:n,isSaveDisabled:a,isCancelDisabled:i})=>r(m,{children:[e(u,{onCancel:n,disabled:i}),e(p,{onSave:t,disabled:a})]});export{y as S};
