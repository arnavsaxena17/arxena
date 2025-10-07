import{U as e,n as d,V as u,j as t,W as b,X as g}from"./index-BzerUb1B.js";const S=e.object({dbname:e.string().min(1),host:e.string().min(1),port:e.preprocess(a=>parseInt(a),e.number().positive()),user:e.string().min(1),password:e.string().min(1),schema:e.string().min(1),label:e.string().min(1)}),w=e.object({api_key:e.string().min(1),label:e.string().min(1)}),h=d.div`
  display: grid;
  gap: ${({theme:a})=>a.spacing(2,4)};
  grid-template-columns: 1fr 1fr;
  grid-template-areas:
    'input-1 input-1'
    'input-2 input-3'
    'input-4 input-5';

  & :first-of-type {
    grid-area: input-1;
  }
`,f=a=>{switch(a){case"postgresql":return[{name:"dbname",label:"Database Name",placeholder:"default"},{name:"host",label:"Host",placeholder:"host"},{name:"port",label:"Port",placeholder:"5432"},{name:"user",label:"User",placeholder:"user"},{name:"password",label:"Password",type:"password",placeholder:"••••••"},{name:"schema",label:"Schema",placeholder:"public"},{name:"label",label:"Label",placeholder:"My database"}];case"stripe":return[{name:"api_key",label:"API Key",placeholder:"API key"},{name:"label",label:"Label",placeholder:"My database"}];default:return null}},I=({databaseKey:a,disabled:s})=>{const{control:l}=u(),n=f(a);return n?t(h,{children:n.map(({name:r,label:o,type:i,placeholder:p})=>t(b,{name:r,control:l,render:({field:{onChange:m,value:c}})=>t(g,{autoComplete:"new-password",label:o,value:c,onChange:m,fullWidth:!0,type:i,disabled:s,placeholder:p})},r))}):null};export{I as S,w as a,S as s};
