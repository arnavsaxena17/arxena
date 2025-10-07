import{n as l,e as y,f as S,g as f,h as p,R as s,k as C,l as u,m as M,o as _,a as i,j as t,I as E,B as o,p as b,q as h}from"./index-DB0OKRlD.js";const m=l(y)`
  align-items: center;
  display: flex;
  height: ${({theme:e})=>e.spacing(6)};
`,x=l(S)`
  display: flex;
  justify-content: center;
  gap: ${({theme:e})=>e.spacing(2)};
`,G=({label:e})=>{const{triggerApisOAuth:n}=f(),{i18n:a,_:I}=p(),d=s(C),c=s(u),r=s(M),g=s(_);return i(h,{children:[t(m,{children:e||a._({id:"pwenQu"})}),i(x,{children:[(d||r)&&t(o,{Icon:E,title:a._({id:"Zgi9Fd"}),variant:"secondary",onClick:()=>n("google")}),(c||g)&&t(o,{Icon:b,title:a._({id:"IOfqM8"}),variant:"secondary",onClick:()=>n("microsoft")})]})]})};export{G as S};
