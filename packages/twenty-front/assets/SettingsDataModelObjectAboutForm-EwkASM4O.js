import{ap as N,n as g,h as O,V as R,L as b,M as p,a as t,j as n,aq as q,W as h,X as y,ar as P,as as m,at as H,ag as X,ah as G,q as J,au as K,av as U,aw as T}from"./index-DB0OKRlD.js";import{S as Q}from"./SettingsOptionCardContentToggle-BMac9lr7.js";import{D as Y}from"./DatabaseIdentifierMaximumLength-BqipT9z5.js";import{T as Z}from"./TextArea-DKo5tlzu.js";const L=Y,ol=N.pick({description:!0,icon:!0,labelPlural:!0,labelSingular:!0}).merge(N.pick({nameSingular:!0,namePlural:!0,isLabelSyncedWithName:!0}).partial()),B=g.div`
  display: flex;
  gap: ${({theme:i})=>i.spacing(2)};
  margin-bottom: ${({theme:i})=>i.spacing(2)};
  width: 100%;
`,W=g.div`
  display: flex;
  flex-direction: column;
`,I=g.div`
  display: flex;
  flex-direction: column;
  gap: ${({theme:i})=>i.spacing(4)};
  width: 100%;
  flex: 1;
`,M=g.div`
  padding-top: ${({theme:i})=>i.spacing(4)};
`,j=g.div`
  display: flex;
  gap: ${({theme:i})=>i.spacing(2)};
  position: relative;
  width: 100%;
`,ll=g.span`
  color: ${({theme:i})=>i.font.color.light};
  font-size: ${({theme:i})=>i.font.size.xs};
  font-weight: ${({theme:i})=>i.font.weight.semiBold};
  margin-bottom: ${({theme:i})=>i.spacing(1)};
`,$="info-circle-id",w="isLabelSyncedWithName",al=({disableEdition:i,objectMetadataItem:l,onBlur:o})=>{const{i18n:a,_:il}=O(),{control:u,watch:d,setValue:f}=R(),_=b(),c=d(w)??(p(l)?l.isLabelSyncedWithName:!0),D=d("labelSingular"),E=d("labelPlural");d("nameSingular"),d("namePlural"),d("description"),d("icon");const x=c?a._({id:"qk4i22"}):a._({id:"JE2tjr"}),v=e=>{const r=p(e)?U.plural(e):"";f("labelPlural",r,{shouldDirty:!!p(e)}),c===!0&&S(r)},C=e=>{p(e)&&f("nameSingular",T(e),{shouldDirty:!0})},S=e=>{p(e)&&f("namePlural",T(e),{shouldDirty:!0})};return t(m,{children:[t(B,{children:[t(W,{children:[n(ll,{children:"Icon"}),n(h,{name:"icon",control:u,defaultValue:(l==null?void 0:l.icon)??"IconListNumbers",render:({field:{onChange:e,value:r}})=>n(q,{disabled:i,selectedIconKey:r,onChange:({iconKey:s})=>{e(s),o==null||o()}})})]}),n(h,{name:"labelSingular",control:u,defaultValue:l==null?void 0:l.labelSingular,render:({field:{onChange:e,value:r}})=>n(y,{label:"Singular",placeholder:"Listing",value:r,onChange:s=>{e(s),v(s),c===!0&&C(s)},onBlur:o,disabled:i,fullWidth:!0,maxLength:L})},"object-labelSingular-text-input"),n(h,{name:"labelPlural",control:u,defaultValue:l==null?void 0:l.labelPlural,render:({field:{onChange:e,value:r}})=>n(y,{label:a._({id:"BPig2P"}),placeholder:a._({id:"DL2sg0"}),value:r,onChange:s=>{e(s),c===!0&&S(s)},disabled:i,fullWidth:!0,maxLength:L})},"object-labelPlural-text-input")]}),n(h,{name:"description",control:u,defaultValue:(l==null?void 0:l.description)??null,render:({field:{onChange:e,value:r}})=>n(Z,{placeholder:a._({id:"Q9pNST"}),minRows:4,value:r??void 0,onChange:s=>e(s??null),disabled:i,onBlur:o})}),n(M,{children:n(j,{children:t(I,{children:[[{label:a._({id:"KclpRp"}),fieldName:"nameSingular",placeholder:"listing",defaultValue:l==null?void 0:l.nameSingular,disableEdition:i||c,tooltip:x},{label:a._({id:"lwCAhN"}),fieldName:"namePlural",placeholder:"listings",defaultValue:l==null?void 0:l.namePlural,disableEdition:i||c,tooltip:x}].map(({defaultValue:e,fieldName:r,label:s,placeholder:V,disableEdition:F,tooltip:A})=>n(P,{children:n(W,{children:n(h,{name:r,control:u,defaultValue:e,render:({field:{onChange:k,value:z}})=>n(m,{children:n(y,{label:s,placeholder:V,value:z,onChange:k,disabled:F,fullWidth:!0,maxLength:L,onBlur:o,RightIcon:()=>A&&t(m,{children:[n(H,{id:$+r,size:_.icon.size.md,color:_.font.color.tertiary,style:{outline:"none"}}),n(X,{anchorSelect:`#${$}${r}`,content:A,offset:5,noArrow:!0,place:"bottom",positionStrategy:"fixed",delay:G.shortDelay})]})})})})})},`object-${r}-text-input`)),n(P,{children:n(h,{name:w,control:u,defaultValue:(l==null?void 0:l.isLabelSyncedWithName)??!0,render:({field:{onChange:e,value:r}})=>n(J,{rounded:!0,children:n(Q,{Icon:K,title:a._({id:"WZ6bN9"}),description:a._({id:"WFtdWr"}),checked:r??!0,disabled:p(l)&&!l.isCustom,advancedMode:!0,onChange:s=>{e(s),s===!0&&(S(E),C(D)),o==null||o()}})})})})]})})})]})};export{w as I,al as S,ol as s};
