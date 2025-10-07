import{aK as h,aZ as m,r as a,n as i,q as C,f,j as n,a as c,Y as u,c4 as w,K as y,t as g,$ as B,Z as S,a3 as x,s as l,b as F,H as v}from"./index-DB0OKRlD.js";import{G as b}from"./findManyDatabaseConnections-8cpeNqqD.js";import{g as I,u as L}from"./useIsSettingsIntegrationEnabled-GkLBa4L6.js";import{S as E}from"./SettingsPageContainer-C2QLAmOr.js";import{S as k}from"./SettingsListCard-D5UQeEUm.js";import{S as K}from"./SettingsIntegrationDatabaseConnectionSyncStatus-DxTMllhm.js";import{u as $}from"./useSettingsIntegrationCategories-7oDC7PjT.js";import{S as U}from"./SubMenuTopBarContainer-9LB8hreq.js";import"./useGetDatabaseConnectionTables-BZl1l-vh.js";const D=({databaseKey:e,skip:r})=>{const o=h(),t=I(e),{data:s}=m(b,{client:o??void 0,skip:r||!o||!t,variables:{input:{foreignDataWrapperType:t||""}}});return{connections:(s==null?void 0:s.findManyRemoteServersByType)||[]}},H="data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20xmlns:xlink='http://www.w3.org/1999/xlink'%20fill='none'%20viewBox='0%200%20512%20144'%3e%3crect%20width='539'%20height='143'%20x='-13.5'%20y='.5'%20fill='url(%23a)'%20fill-opacity='.05'%20rx='7.5'/%3e%3crect%20width='539'%20height='143'%20x='-13.5'%20y='.5'%20fill='url(%23b)'%20rx='7.5'/%3e%3crect%20width='539'%20height='143'%20x='-13.5'%20y='.5'%20stroke='%23EBEBEB'%20rx='7.5'/%3e%3cdefs%3e%3cradialGradient%20id='b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='matrix(270%200%200%20487.572%20256%2072)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FCFCFC'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23F8F8F8'%20stop-opacity='.9'/%3e%3c/radialGradient%3e%3cpattern%20id='a'%20width='.044'%20height='.167'%20patternContentUnits='objectBoundingBox'%3e%3cuse%20xlink:href='%23c'%20transform='scale(.00035%20.0013)'/%3e%3c/pattern%3e%3cimage%20xlink:href='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAACXBIWXMAABYlAAAWJQFJUiTwAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAFaSURBVHgB7d2xDcAgDABBO/vvTETLCvfX0aKX5c47rvO8d0DfhFYAuALAFQCuAHAFgCsAXAHgCgBXALgCwBUArgBwBYArAFwB4AoAVwC4AsAVAK4AcAWAKwBcAeAKAFcAuALAFQCuAHAFgCsAXAHgCgBXALgCwBUArgBwBYArAFwB4AoAVwC4AsAVAK4AcAWAKwBcAeAKAFcAuALAFQCuAHAFgCsAXAHgCgBXALgCwBUArgBw92L2mbCaALgCwBUAbsf17j7kXzQBcAWAKwBcAeAKAFcAuALAFQCuAHAFgCsAXAHgCgBXALgCwBUArgBwBYArAFwB4AoAVwC4AsAVAK4AcAWAKwBcAeAKAFcAuALAFQCuAHAFgCsAXAHgCgBXALgCwBUArgBwBYArAFwB4AoAVwC4AsAVAK4AcAWAKwBcAeAKAFcAuALAFQCuAHAFgCsAXAHgCgD3A+UEA/3CEUcsAAAAAElFTkSuQmCC'%20id='c'%20width='128'%20height='128'/%3e%3c/defs%3e%3c/svg%3e",X=e=>a.createElement("svg",{xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 126 23",...e},a.createElement("path",{stroke:"#000",strokeDasharray:"4.71 4.71",strokeLinecap:"round",strokeWidth:1.768,d:"M125 11H1"}),a.createElement("g",{filter:"url(#a)"},a.createElement("circle",{cx:63,cy:11,r:10.667,fill:"#fff",style:{mixBlendMode:"normal"}}),a.createElement("circle",{cx:63,cy:11,r:10.203,stroke:"#000",strokeWidth:.928})),a.createElement("path",{fill:"#000",d:"M60.38 8.425a3.758 3.758 0 0 1 5.223-.022l-.955.935a.54.54 0 0 0-.12.597c.085.205.29.337.514.337h2.968a.55.55 0 0 0 .557-.547V6.811a.546.546 0 0 0-.343-.506.565.565 0 0 0-.608.119l-.964.947c-2.032-1.97-5.304-1.963-7.323.023a5.06 5.06 0 0 0-1.225 1.908.725.725 0 0 0 .453.929.746.746 0 0 0 .946-.444 3.6 3.6 0 0 1 .876-1.362Zm-2.944 3.85v2.915c0 .221.135.422.344.506a.565.565 0 0 0 .607-.118l.965-.948c2.031 1.97 5.303 1.963 7.323-.023a5.077 5.077 0 0 0 1.227-1.905.725.725 0 0 0-.453-.93.746.746 0 0 0-.946.445 3.598 3.598 0 0 1-.876 1.361 3.758 3.758 0 0 1-5.225.023l.953-.938a.54.54 0 0 0 .12-.597.556.556 0 0 0-.514-.337h-2.968a.55.55 0 0 0-.556.547Z"}),a.createElement("defs",null,a.createElement("filter",{id:"a",width:22.261,height:22.261,x:51.406,y:.333,colorInterpolationFilters:"sRGB",filterUnits:"userSpaceOnUse"},a.createElement("feOffset",{dx:-.93,dy:.928}),a.createElement("feColorMatrix",{values:"0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0"}),a.createElement("feBlend",{in:"SourceGraphic",result:"shape"})))),T=i(C)`
  border: 0;
`,W=i(f)`
  background-image: url(${H});
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: ${({theme:e})=>e.spacing(1)};
  height: ${({theme:e})=>e.spacing(28)};
`,Q=i.div`
  align-items: center;
  display: flex;
  justify-content: center;
  gap: ${({theme:e})=>e.spacing(4)};
`,R=i.div`
  align-items: center;
  display: flex;
  height: ${({theme:e})=>e.spacing(16)};
  justify-content: center;
  width: ${({theme:e})=>e.spacing(16)};
`,j=i.img`
  height: 100%;
`,V=i.img`
  height: ${({theme:e})=>e.spacing(12)};
  padding: ${({theme:e})=>e.spacing(2)};
`,M=i(X)`
  width: ${({theme:e})=>e.spacing(31)};
`,N=i.div`
  color: ${({theme:e})=>e.font.color.tertiary};
  font-size: ${({theme:e})=>e.font.size.sm};
  font-weight: ${({theme:e})=>e.font.weight.medium};
  line-height: ${({theme:e})=>e.spacing(6)};
`,Y=({integrationLogoUrl:e})=>n(T,{children:c(W,{children:[c(Q,{children:[n(R,{children:n(j,{alt:"",src:e})}),n(M,{}),n(V,{alt:"",src:"/images/integrations/twenty-logo.svg"})]}),n(N,{children:"Import your tables as remote objects"})]})}),G=i.div`
  align-items: center;
  display: flex;
  height: ${({theme:e})=>e.spacing(4)};
  justify-content: center;
  width: ${({theme:e})=>e.spacing(4)};
`,O=i.img`
  height: 100%;
`,P=i.div`
  align-items: center;
  display: flex;
  gap: ${({theme:e})=>e.spacing(1)};
`,Z=({integration:e,connections:r})=>{const o=u();return n(k,{items:r,RowIcon:()=>n(G,{children:n(O,{alt:"",src:e.from.image})}),RowRightComponent:({item:t})=>c(P,{children:[n(K,{connectionId:t.id}),n(w,{Icon:y,accent:"tertiary"})]}),onRowClick:t=>o(g.IntegrationDatabaseConnection,{databaseKey:e.from.key,connectionId:t.id}),getItemLabel:t=>t.label,hasFooter:!0,footerButtonLabel:"Add connection",onFooterButtonClick:()=>o(g.IntegrationNewDatabaseConnection,{databaseKey:e.from.key})})},oe=()=>{const{databaseKey:e=""}=B(),r=S(),[o]=$(),t=o.integrations.find(({from:{key:p}})=>p===e),s=L(e),A=!!t&&s;a.useEffect(()=>{A||r(x.NotFound)},[t,e,r,A]);const{connections:d}=D({databaseKey:e,skip:!A});return A?n(U,{title:t.text,links:[{children:"Workspace",href:l(g.Workspace)},{children:"Integrations",href:l(g.Integrations)},{children:t.text}],children:c(E,{children:[n(Y,{integrationLogoUrl:t.from.image}),c(F,{children:[n(v,{title:`${t.text} database`,description:`Connect or access your ${t.text} data`}),n(Z,{integration:t,connections:d})]})]})}):null};export{oe as SettingsIntegrationDatabase};
