import{v as d,aK as N,aM as f,aQ as E,Y as C,r as g,aR as h,aS as S,aC as l,t as s,j as a,s as F,M as O}from"./index-BzerUb1B.js";import{S as R}from"./SaveAndCancelButtons-t1Yndyjc.js";import{S as w}from"./SettingsPageContainer-VijhEKua.js";import{S as M}from"./SubMenuTopBarContainer-DvhK9_Ug.js";import{S as i,a as _}from"./SettingsServerlessFunctionNewForm-BGKqJxIs.js";import{S as y}from"./serverlessFunctionFragment-D0CsKo3J.js";import{F as k}from"./findManyServerlessFunctions-UJbX11hF.js";import"./IconDeviceFloppy-Dqs9eNjb.js";import"./TextArea-DEwBENQ4.js";const I=d`
  ${y}
  mutation CreateOneServerlessFunctionItem(
    $input: CreateServerlessFunctionInput!
  ) {
    createOneServerlessFunction(input: $input) {
      ...ServerlessFunctionFields
    }
  }
`,T=()=>{const n=N(),[e]=f(I,{client:n});return{createOneServerlessFunction:async r=>await e({variables:{input:r},awaitRefetchQueries:!0,refetchQueries:[E(k)??""]})}},Q=()=>{const n=C(),[e,c]=g.useState({name:"",description:""}),{createOneServerlessFunction:r}=T(),u=async()=>{const t=await r({name:e.name,description:e.description});O(t==null?void 0:t.data)&&n(s.ServerlessFunctions,{id:t.data.createOneServerlessFunction.id})},m=t=>p=>{c(v=>({...v,[t]:p}))},o=!!e.name&&r;return h(i.ServerlessFunctionNew),S([l.Key.Enter],()=>{o!==!1&&u()},i.ServerlessFunctionNew,[o]),S([l.Key.Escape],()=>{n(s.ServerlessFunctions)},i.ServerlessFunctionNew),a(M,{title:"New Function",links:[{children:"Workspace",href:F(s.Workspace)},{children:"Functions",href:F(s.ServerlessFunctions)},{children:"New"}],actionButton:a(R,{isSaveDisabled:!o,onCancel:()=>{n(s.ServerlessFunctions)},onSave:u}),children:a(w,{children:a(_,{formValues:e,onChange:m})})})};export{Q as SettingsServerlessFunctionsNew,Q as default};
