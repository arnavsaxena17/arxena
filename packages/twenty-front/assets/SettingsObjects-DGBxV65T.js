import{aK as k,aM as $,aL as B,cZ as z,aZ as R,c_ as F,n as d,L as _,bA as H,a as u,j as a,q as Q,h as A,c$ as U,d0 as G,t as h,d1 as Z,c4 as q,d2 as J,d3 as S,bb as K,d4 as V,d5 as W,K as Y,X,r as b,a0 as ee,bn as te,s as O,B as ae,ai as ne,T as j,b as oe,H as le,d6 as ie,D as v,as as se}from"./index-BzerUb1B.js";import{D as re}from"./mutations-gCIfaPsk.js";import{u as ce,a as w,S as de,T as L}from"./useSortedArray-BHi0otLc.js";import{S as ue}from"./SettingsPageContainer-VijhEKua.js";import{g as T,S as me}from"./getObjectTypeLabel-D6UsLq__.js";import{T as be,a as g,S as pe}from"./Table-_VNdQp1e.js";import{I as ge}from"./IconArchiveOff-Be_GPve8.js";import{S as fe}from"./SubMenuTopBarContainer-DvhK9_Ug.js";import{S as he}from"./TableHeader-BaKK11nR.js";import"./TableBody-M9Ou8IjE.js";const ye=()=>{const e=k(),[n]=$(re,{client:e}),{refreshObjectMetadataItems:i}=B("network-only");return{deleteOneObjectMetadataItem:async l=>{const s=await n({variables:{idToDelete:l}});return await i(),s}}},Ce=({objectMetadataItems:e,skip:n=!1})=>{const i=e.map(r=>({objectNameSingular:r.nameSingular,variables:{},fields:{id:!0}})),o=z({operationSignatures:i}),{data:l}=R(o??F,{skip:n});return{totalCountByObjectMetadataItemNamePlural:Object.fromEntries(Object.entries(l??{}).map(([r,c])=>[r,c.totalCount]))}},P=d(be)`
  grid-template-columns: 180px 98.7px 98.7px 98.7px 36px;
`,Oe=d(g)`
  color: ${({theme:e})=>e.font.color.primary};
  gap: ${({theme:e})=>e.spacing(2)};
`,Te=d.div`
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
`,Ie=d(g)`
  justify-content: center;
  padding-right: ${({theme:e})=>e.spacing(1)};
`,M=({action:e,objectMetadataItem:n,link:i,totalObjectCount:o})=>{const l=_(),{getIcon:s}=H(),r=s(n.icon),c=T(n);return u(P,{to:i,children:[u(Oe,{children:[!!r&&a(r,{style:{minWidth:l.icon.size.md},size:l.icon.size.md,stroke:l.icon.stroke.sm}),a(Te,{title:n.labelPlural,children:n.labelPlural})]}),a(g,{children:a(me,{objectTypeLabel:c})}),a(g,{align:"right",children:n.fields.filter(m=>!m.isSystem).length}),a(g,{align:"right",children:o}),a(Ie,{children:e})]},n.namePlural)},Se="/assets/cover-dark-C8JQZqzH.png",je="/assets/cover-light-DdApNeZg.png",ve=d(Q)`
  align-items: center;
  background-image: ${({theme:e})=>e.name==="light"?`url('${je.toString()}')`:`url('${Se.toString()}')`};
  background-size: cover;
  border-radius: ${({theme:e})=>e.border.radius.md};
  box-sizing: border-box;
  display: flex;
  height: 153px;
  justify-content: center;
  position: relative;
  margin-bottom: ${({theme:e})=>e.spacing(8)};
`,we=d.div`
  padding-top: ${({theme:e})=>e.spacing(5)};
`,Le=()=>{const{i18n:e,_:n}=A();return a(ve,{children:a(we,{children:a(U,{Icon:G,title:e._({id:"6n7jtr"}),size:"small",to:"/settings/"+h.ObjectOverview})})})},Me=({onActivate:e,scopeKey:n,onDelete:i,isCustomObject:o})=>{const l=`${n}-settings-object-inactive-menu-dropdown`,{closeDropdown:s}=Z(l);return a(W,{dropdownId:l,clickableComponent:a(q,{"aria-label":"Inactive Object Options",Icon:J,accent:"tertiary"}),dropdownMenuWidth:160,dropdownComponents:u(V,{children:[a(S,{text:"Activate",LeftIcon:ge,onClick:()=>{e(),s()}}),o&&a(S,{text:"Delete",LeftIcon:K,accent:"danger",onClick:()=>{i(),s()}})]}),dropdownHotkeyScope:{scope:l}})},p={tableId:"settingsObject",fields:[{fieldLabel:{id:"6YtxFj"},fieldName:"labelPlural",fieldType:"string",align:"left"},{fieldLabel:{id:"+zy2Nq"},fieldName:"objectTypeLabel",fieldType:"string",align:"left"},{fieldLabel:{id:"vF68cg"},fieldName:"fieldsCount",fieldType:"number",align:"right"},{fieldLabel:{id:"AwUsnG"},fieldName:"totalObjectCount",fieldType:"number",align:"right"}],initialSort:{fieldName:"labelPlural",orderBy:"AscNullsLast"}},_e=d(Y)`
  color: ${({theme:e})=>e.font.color.tertiary};
`,Ae=d(X)`
  padding-bottom: ${({theme:e})=>e.spacing(2)};
  width: 100%;
`,Fe=()=>{const{i18n:e,_:n}=A(),i=_(),[o,l]=b.useState(""),{deleteOneObjectMetadataItem:s}=ye(),{updateOneObjectMetadataItem:r}=ce(),{activeObjectMetadataItems:c,inactiveObjectMetadataItems:m}=ee(),{totalCountByObjectMetadataItemNamePlural:f}=Ce({objectMetadataItems:[...c,...m]}),N=b.useMemo(()=>c.map(t=>({objectMetadataItem:t,labelPlural:t.labelPlural,objectTypeLabel:T(t).labelText,fieldsCount:t.fields.filter(C=>!C.isSystem).length,totalObjectCount:f[t.namePlural]??0})),[c,f]),x=b.useMemo(()=>m.map(t=>({objectMetadataItem:t,labelPlural:t.labelPlural,objectTypeLabel:T(t).labelText,fieldsCount:t.fields.filter(C=>!C.isSystem).length,totalObjectCount:f[t.namePlural]??0})),[m,f]),y=w(N,p),I=w(x,p),D=b.useMemo(()=>y.filter(t=>t.labelPlural.toLowerCase().includes(o.toLowerCase())||t.objectTypeLabel.toLowerCase().includes(o.toLowerCase())),[y,o]),E=b.useMemo(()=>I.filter(t=>t.labelPlural.toLowerCase().includes(o.toLowerCase())||t.objectTypeLabel.toLowerCase().includes(o.toLowerCase())),[I,o]);return a(fe,{title:e._({id:"5cNMFz"}),actionButton:a(te,{to:O(h.NewObject),children:a(ae,{Icon:ne,title:e._({id:"dEO3Zx"}),accent:"blue",size:"small"})}),links:[{children:a(j,{id:"pmUArF"}),href:O(h.Workspace)},{children:a(j,{id:"B3toQF"})}],children:a(ue,{children:u(se,{children:[a(Le,{}),u(oe,{children:[a(le,{title:e._({id:"fV7V51"})}),a(Ae,{LeftIcon:ie,placeholder:e._({id:"ofuw3g"}),value:o,onChange:l}),u(pe,{children:[u(P,{children:[p.fields.map(t=>a(de,{fieldName:t.fieldName,label:e._(t.fieldLabel),tableId:p.tableId,align:t.align,initialSort:p.initialSort},t.fieldName)),a(he,{})]}),v.isNonEmptyArray(y)&&a(L,{title:e._({id:"F6pfE9"}),children:D.map(t=>a(M,{objectMetadataItem:t.objectMetadataItem,totalObjectCount:t.totalObjectCount,action:a(_e,{size:i.icon.size.md,stroke:i.icon.stroke.sm}),link:O(h.ObjectDetail,{objectNamePlural:t.objectMetadataItem.namePlural})},t.objectMetadataItem.namePlural))}),v.isNonEmptyArray(m)&&a(L,{title:e._({id:"NoNwIX"}),children:E.map(t=>a(M,{objectMetadataItem:t.objectMetadataItem,totalObjectCount:t.totalObjectCount,action:a(Me,{isCustomObject:t.objectMetadataItem.isCustom,scopeKey:t.objectMetadataItem.namePlural,onActivate:()=>r({idToUpdate:t.objectMetadataItem.id,updatePayload:{isActive:!0}}),onDelete:()=>s(t.objectMetadataItem.id)})},t.objectMetadataItem.namePlural))})]})]})]})})})};export{Fe as SettingsObjects};
