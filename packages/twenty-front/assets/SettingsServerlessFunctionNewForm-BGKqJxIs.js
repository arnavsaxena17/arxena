import{n as i,a as t,j as n,H as a,X as o,b as l}from"./index-BzerUb1B.js";import{T as u}from"./TextArea-DEwBENQ4.js";var r;(function(e){e.ServerlessFunction="serverless-function",e.ServerlessFunctionNew="serverless-function-new",e.ServerlessFunctionDetail="serverless-function-detail",e.ServerlessFunctionSettingsTab="serverless-function-settings-tab",e.ServerlessFunctionEditorTab="serverless-function-editor-tab",e.ServerlessFunctionTestTab="serverless-function-test-tab"})(r||(r={}));const c=i.div`
  display: flex;
  flex-direction: column;
  gap: ${({theme:e})=>e.spacing(4)};
`,f=({formValues:e,onChange:s})=>t(l,{children:[n(a,{title:"About",description:"Name and set your function"}),t(c,{children:[n(o,{placeholder:"Name",fullWidth:!0,autoFocusOnMount:!0,value:e.name,onChange:s("name")}),n(u,{placeholder:"Description",minRows:4,value:e.description,onChange:s("description")})]})]});export{r as S,f as a};
