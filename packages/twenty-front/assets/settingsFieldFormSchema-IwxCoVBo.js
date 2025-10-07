import{M as z,eX as x,L as M,a as y,dQ as _e,j as t,eY as se,eZ as xe,e_ as Ie,e$ as Pe,V as b,W as f,f0 as k,n as p,h as ae,aq as ce,X as j,f1 as ke,ar as U,as as E,at as je,ag as ze,ah as We,q as de,au as Be,aw as Me,f as Y,T as Ue,U as a,f2 as Ye,eu as ue,f3 as pe,aD as A,eN as ge,dD as I,cT as he,f4 as Ge,f5 as Xe,B as He,cW as qe,ai as me,f6 as Ke,f7 as Qe,d0 as Je,f8 as Ze,a0 as G,r as Q,f9 as Se,bD as v,bA as et,u as ye,a6 as s,fa as tt,bY as nt,fb as ot,c4 as lt,d1 as J,d4 as Z,d5 as ee,d2 as it,dw as rt,d3 as W,bb as st,ey as B,ez as at,aT as ct,aN as dt,R as ut,ex as pt,fc as gt,fd as ht,fe as te,ff as mt,a8 as St,dz as yt}from"./index-DB0OKRlD.js";import{T as ft}from"./TextArea-DKo5tlzu.js";import{S as fe,a as be,b as Fe,c as Ce,d as we,e as De,f as bt}from"./SettingsOptionCardContentToggle-BMac9lr7.js";import{D as X}from"./DatabaseIdentifierMaximumLength-BqipT9z5.js";import{a as N,u as Ee,b as Te,c as P,d as Oe,s as Ft}from"./SettingsObjectNewFieldSelect-BCzOso19.js";import{I as Ve,a as Ct,b as wt,c as Dt,d as Et,e as Tt}from"./IconTextWrap-Ceb6sX-w.js";import{S as O,d as Ot,e as Vt,a as Nt,R as H,s as Lt,m as vt}from"./SettingsDataModelFieldPreviewCard-D00c7b03.js";const At=e=>{if(!z(e))return x[0];const o=(x.findIndex(i=>i===e)+1)%x.length;return x[o]},$t={green:"Green",turquoise:"Turquoise",sky:"Sky",blue:"Blue",purple:"Purple",pink:"Pink",red:"Red",orange:"Orange",yellow:"Yellow",gray:"Gray"},Rt=({color:e,selected:n,className:o,onClick:i,disabled:r,hovered:u,variant:c="default"})=>{const l=M();return y(Pe,{onClick:i,className:o,selected:n,disabled:r,hovered:u,children:[y(_e,{children:[t(se,{colorName:e,variant:c}),t(xe,{children:$t[e]})]}),n&&t(Ie,{size:l.icon.size.md})]})},_t=X,xt=()=>k([]).pick({description:!0}),Eo=({disabled:e,fieldMetadataItem:n})=>{const{control:o}=b();return t(f,{name:"description",control:o,defaultValue:n==null?void 0:n.description,render:({field:{onChange:i,value:r}})=>t(ft,{placeholder:"Write a description",minRows:4,value:r??void 0,onChange:i,disabled:e})})},It=(e=[])=>k(e).pick({icon:!0,label:!0}).merge(k().pick({name:!0,isLabelSyncedWithName:!0}).partial()),ne=p.div`
  display: flex;
  gap: ${({theme:e})=>e.spacing(2)};
  margin-bottom: ${({theme:e})=>e.spacing(2)};
  width: 100%;
`,Pt=p.div`
  display: flex;
  flex-direction: column;
  gap: ${({theme:e})=>e.spacing(4)};
  width: 100%;
  flex: 1;
`,kt=p.div`
  padding-top: ${({theme:e})=>e.spacing(4)};
`,jt=p.div`
  display: flex;
  gap: ${({theme:e})=>e.spacing(2)};
  position: relative;
  width: 100%;
`,To=({canToggleSyncLabelWithName:e=!0,disabled:n,fieldMetadataItem:o,maxLength:i})=>{const{control:r,setValue:u,watch:c,formState:{errors:l}}=b(),S=M(),{i18n:h,_:C}=ae(),F=c("isLabelSyncedWithName")??(z(o)?o.isLabelSyncedWithName:!0),w=c("label"),T=F?h._({id:"qk4i22"}):h._({id:"JE2tjr"}),L=d=>{z(d)&&u("name",Me(d),{shouldDirty:!0})};return y(E,{children:[y(ne,{children:[t(f,{name:"icon",control:r,defaultValue:(o==null?void 0:o.icon)??"IconUsers",render:({field:{onChange:d,value:g}})=>t(ce,{disabled:n,selectedIconKey:g??"",onChange:({iconKey:m})=>d(m),variant:"primary"})}),t(f,{name:"label",control:r,defaultValue:o==null?void 0:o.label,render:({field:{onChange:d,value:g}})=>{var m;return t(j,{placeholder:h._({id:"gqv5ZL"}),value:g,onChange:D=>{d(D),F===!0&&L(D)},error:ke((m=l.label)==null?void 0:m.message),disabled:n,maxLength:i,fullWidth:!0})}})]}),e&&t(kt,{children:t(U,{children:t(jt,{children:y(Pt,{children:[t(ne,{children:t(f,{name:"name",control:r,defaultValue:o==null?void 0:o.name,render:({field:{onChange:d,value:g}})=>t(E,{children:t(j,{label:h._({id:"kAtj+q"}),placeholder:h._({id:"eXoH4Q"}),value:g,onChange:d,disabled:n||(F??!1),fullWidth:!0,maxLength:X,RightIcon:()=>T&&y(E,{children:[t(je,{id:"info-circle-id-name",size:S.icon.size.md,color:S.font.color.tertiary,style:{outline:"none"}}),t(ze,{anchorSelect:"#info-circle-id-name",content:T,offset:5,noArrow:!0,place:"bottom",positionStrategy:"fixed",delay:We.shortDelay})]})})})})}),t(f,{name:"isLabelSyncedWithName",control:r,defaultValue:(o==null?void 0:o.isLabelSyncedWithName)??!0,render:({field:{onChange:d,value:g}})=>t(de,{rounded:!0,children:t(fe,{Icon:Be,title:h._({id:"AtzMpB"}),description:h._({id:"gWk8gY"}),checked:g??!0,disabled:z(o)&&!o.isCustom,advancedMode:!0,onChange:m=>{d(m),m===!0&&L(w)}})})})]})})})})]})},zt=p.h3`
  color: ${({theme:e})=>e.font.color.extraLight};
  font-size: ${({theme:e})=>e.font.size.sm};
  font-weight: ${({theme:e})=>e.font.weight.medium};
  margin: 0;
  margin-bottom: ${({theme:e})=>e.spacing(4)};
`,Wt=p(Y)`
  background-color: ${({theme:e})=>e.background.transparent.lighter};
`,Bt=p(Y)`
  padding: 0;
`,V=({className:e,preview:n,form:o})=>y(de,{className:e,fullWidth:!0,rounded:!0,children:[y(Wt,{divider:!!o,children:[t(zt,{children:t(Ue,{id:"rdUucN"})}),n]}),!!o&&t(Bt,{children:o})]}),Mt=p.div`
  margin-left: auto;
`,R=({Icon:e,title:n,description:o,disabled:i=!1,children:r})=>y(De,{disabled:i,children:[e&&t(Fe,{children:t(be,{Icon:e})}),y("div",{children:[t(Ce,{children:n}),t(we,{children:o})]}),t(Mt,{children:r})]}),Ut=a.object({defaultValue:Ye}),Yt=({disabled:e,fieldMetadataItem:n})=>{const{control:o}=b(),i=[{label:"No country",value:"",Icon:ue},...pe().sort((u,c)=>u.countryName.localeCompare(c.countryName)).map(({countryName:u,Flag:c})=>({label:u,value:u,Icon:l=>c({width:l.size,height:l.size})}))];return t(f,{name:"defaultValue",defaultValue:{...{addressStreet1:"''",addressStreet2:null,addressCity:null,addressState:null,addressPostcode:null,addressCountry:null,addressLat:null,addressLng:null},...n==null?void 0:n.defaultValue},control:o,render:({field:{onChange:u,value:c}})=>{const l=(c==null?void 0:c.addressCountry)||"";return t(R,{Icon:Ve,title:"Default Country",description:"The default country for new addresses",children:t(A,{dropdownWidth:220,disabled:e,dropdownId:"selectDefaultCountry",value:ge(l),onChange:S=>u({...c,addressCountry:N(S)}),options:i,selectSizeVariant:"small",withSearchInput:!0})})}})},Gt=p(O)`
  flex: 1 1 100%;
`,Xt=({disabled:e,fieldMetadataItem:n,objectMetadataItem:o})=>t(V,{preview:t(Gt,{fieldMetadataItem:n,objectMetadataItem:o}),form:t(Yt,{disabled:e,fieldMetadataItem:n})}),Ht=a.object({defaultValue:a.boolean()}),qt=({fieldMetadataItem:e})=>{const{control:n}=b(),{initialDefaultValue:o}=Ee({fieldMetadataItem:e});return t(f,{name:"defaultValue",control:n,defaultValue:o,render:({field:{onChange:i,value:r}})=>t(R,{Icon:I,title:"Default Value",description:"Select the default value for this boolean field",children:t(A,{value:r,onChange:i,dropdownId:"object-field-default-value-select-boolean",dropdownWidth:120,needIconCheck:!1,options:[{value:!0,label:"True",Icon:I},{value:!1,label:"False",Icon:he}],selectSizeVariant:"small"})})})},Kt=p(O)`
  display: grid;
  flex: 1 1 100%;
`,Qt=({fieldMetadataItem:e,objectMetadataItem:n})=>{const{initialDefaultValue:o}=Ee({fieldMetadataItem:e}),{watch:i}=b();return t(V,{preview:t(Kt,{fieldMetadataItem:{...e,defaultValue:i("defaultValue",o)},objectMetadataItem:n}),form:t(qt,{fieldMetadataItem:e})})},Jt=a.object({displayedMaxRows:a.number().nullable()}),Zt=a.object({settings:Jt}),en=({disabled:e,fieldMetadataItem:n})=>{var i;const{control:o}=b();return t(f,{name:"settings",defaultValue:{displayedMaxRows:((i=n==null?void 0:n.settings)==null?void 0:i.displayedMaxRows)||0},control:o,render:({field:{onChange:r,value:u}})=>{const c=(u==null?void 0:u.displayedMaxRows)??0;return t(E,{children:t(R,{Icon:Ct,title:"Wrap on record pages",description:"Display text on multiple lines",children:t(A,{dropdownId:"text-wrap",value:c,onChange:l=>r({displayedMaxRows:l}),disabled:e,options:[{label:"Deactivated",value:0},{label:"First 2 lines",value:2},{label:"First 5 lines",value:5},{label:"First 10 lines",value:10},{label:"All lines",value:99}],selectSizeVariant:"small"})})})}})},tn=p(O)`
  flex: 1 1 100%;
`,nn=({disabled:e,fieldMetadataItem:n,objectMetadataItem:o})=>{const{watch:i}=b();return t(V,{preview:t(tn,{fieldMetadataItem:{...n,settings:i("settings")},objectMetadataItem:o}),form:t(en,{disabled:e,fieldMetadataItem:n})})},on=a.object({defaultValue:Ot}),ln=Object.entries(Ge).map(([e,{label:n,Icon:o}])=>({label:n,value:N(e),Icon:o})),rn=({disabled:e,fieldMetadataItem:n})=>{const{control:o}=b(),{initialAmountMicrosValue:i,initialCurrencyCodeValue:r}=Te({fieldMetadataItem:n});return y(E,{children:[t(f,{name:"defaultValue.amountMicros",control:o,defaultValue:i,render:()=>t(E,{})}),t(f,{name:"defaultValue.currencyCode",control:o,defaultValue:r,render:({field:{onChange:u,value:c}})=>t(R,{Icon:Xe,title:"Default Value",description:"Choose the default currency that will apply",children:t(A,{dropdownWidth:220,value:c,onChange:u,disabled:e,dropdownId:"object-field-default-value-select-currency",options:ln,selectSizeVariant:"small",withSearchInput:!0})})})]})},sn=p(O)`
  display: grid;
  flex: 1 1 100%;
`,an=({disabled:e,fieldMetadataItem:n,objectMetadataItem:o})=>{const{initialDefaultValue:i}=Te({fieldMetadataItem:n}),{watch:r}=b();return t(V,{preview:t(sn,{fieldMetadataItem:{...n,defaultValue:r("defaultValue",i)},objectMetadataItem:o}),form:t(rn,{disabled:e,fieldMetadataItem:n})})},Ne=({fieldMetadataItem:e})=>{var r;const n=(r=e==null?void 0:e.settings)==null?void 0:r.displayAsRelativeDate,{resetField:o}=b();return{initialDisplayAsRelativeDateValue:n,resetDefaultValueField:()=>o("settings.displayAsRelativeDate",{defaultValue:n})}},Le=a.object({settings:a.object({displayAsRelativeDate:a.boolean().optional()}).optional()}),cn=({disabled:e,fieldMetadataItem:n})=>{const{i18n:o,_:i}=ae(),{control:r}=b(),{initialDisplayAsRelativeDateValue:u}=Ne({fieldMetadataItem:n});return t(f,{name:"settings.displayAsRelativeDate",control:r,defaultValue:u,render:({field:{onChange:c,value:l}})=>t(fe,{Icon:wt,title:o._({id:"i66xz9"}),checked:l??!1,disabled:e,onChange:c})})},dn=p(O)`
  display: grid;
  flex: 1 1 100%;
`,un=({disabled:e,fieldMetadataItem:n,objectMetadataItem:o})=>{const{initialDisplayAsRelativeDateValue:i}=Ne({fieldMetadataItem:n}),{watch:r}=b();return t(V,{preview:t(dn,{fieldMetadataItem:{...n,settings:{displayAsRelativeDate:r("settings.displayAsRelativeDate",i)}},objectMetadataItem:o}),form:t(cn,{disabled:e,fieldMetadataItem:n})})},pn=a.object({decimals:a.number().nullable(),type:a.enum(["percentage","number"]).nullable()}),gn=p.div`
  align-items: center;
  display: flex;
  gap: ${({theme:e})=>e.spacing(1)};
  margin-left: auto;
  width: ${({theme:e})=>e.spacing(30)};
`,hn=p(j)`
  width: ${({theme:e})=>e.spacing(16)};
  input {
    width: ${({theme:e})=>e.spacing(16)};
    height: ${({theme:e})=>e.spacing(6)};
    text-align: center;
    font-weight: ${({theme:e})=>e.font.weight.medium};
  }
`,oe=p(He)`
  height: ${({theme:e})=>e.spacing(6)};
  width: ${({theme:e})=>e.spacing(6)};
  padding: 0;
  justify-content: center;
  svg {
    height: ${({theme:e})=>e.spacing(4)};
    width: ${({theme:e})=>e.spacing(4)};
  }
`,mn=({value:e,onChange:n,minValue:o=0,maxValue:i=100,disabled:r=!1})=>{const u=()=>{e<i&&n(e+1)},c=()=>{e>o&&n(e-1)},l=S=>{const h=Ke(S);if(h===null){n(o);return}if(!(h<o)){if(h>i){n(i);return}n(h)}};return y(gn,{children:[t(oe,{variant:"secondary",onClick:c,Icon:qe,disabled:r}),t(hn,{name:"counter",fullWidth:!0,value:e.toString(),onChange:l,disabled:r}),t(oe,{variant:"secondary",onClick:u,Icon:me,disabled:r})]})},Sn=({Icon:e,title:n,description:o,disabled:i=!1,value:r,onChange:u,minValue:c,maxValue:l})=>y(De,{disabled:i,children:[e&&t(Fe,{children:t(be,{Icon:e})}),y("div",{children:[t(Ce,{children:n}),o&&t(we,{children:o})]}),t(mn,{value:r,onChange:u,minValue:c,maxValue:l,disabled:i})]}),yn=a.object({settings:pn}),fn=({disabled:e,fieldMetadataItem:n})=>{var i,r;const{control:o}=b();return t(f,{name:"settings",defaultValue:{decimals:((i=n==null?void 0:n.settings)==null?void 0:i.decimals)??Qe,type:((r=n==null?void 0:n.settings)==null?void 0:r.type)??"number"},control:o,render:({field:{onChange:u,value:c}})=>{const l=(c==null?void 0:c.decimals)??0,S=(c==null?void 0:c.type)??"number";return y(E,{children:[t(R,{Icon:Je,title:"Number type",description:"Display as a plain number or a percentage",children:t(A,{selectSizeVariant:"small",dropdownId:"number-type",dropdownWidth:120,value:S,onChange:h=>u({type:h,decimals:l}),disabled:e,needIconCheck:!1,options:[{Icon:Dt,label:"Number",value:"number"},{Icon:Et,label:"Percentage",value:"percentage"}]})}),t(bt,{}),t(Sn,{Icon:Tt,title:"Number of decimals",description:`E.g. ${(S==="percentage"?99:1e3).toFixed(l)}${S==="percentage"?"%":""} for ${l} decimal${l>1?"s":""}`,value:l,onChange:h=>u({type:S,decimals:h}),disabled:e,minValue:0,maxValue:100})]})}})},bn=p(O)`
  display: grid;
  flex: 1 1 100%;
`,Fn=({disabled:e,fieldMetadataItem:n,objectMetadataItem:o})=>{const{watch:i}=b();return t(V,{preview:t(bn,{fieldMetadataItem:{icon:i("icon"),label:i("label")||"New Field",settings:i("settings")||null,type:n.type},objectMetadataItem:o}),form:t(fn,{disabled:e,fieldMetadataItem:n})})},Cn=a.object({defaultValue:Ze}),wn=({disabled:e,fieldMetadataItem:n})=>{const{control:o}=b(),i=[{label:"No country",value:"",Icon:ue},...pe().sort((c,l)=>c.countryName.localeCompare(l.countryName)).map(c=>({label:`${c.countryName} (+${c.callingCode})`,value:c.countryCode,Icon:l=>c.Flag({width:l.size,height:l.size})}))],r={primaryPhoneNumber:"''",primaryPhoneCountryCode:"''",primaryPhoneCallingCode:"''",additionalPhones:null},u=n==null?void 0:n.defaultValue;return t(f,{name:"defaultValue",defaultValue:{...r,...u},control:o,render:({field:{onChange:c,value:l}})=>t(R,{Icon:Ve,title:"Default Country Code",description:"The default country code for new phone numbers.",children:t(A,{dropdownWidth:"auto",dropdownId:"selectDefaultCountryCode",value:ge(l==null?void 0:l.primaryPhoneCountryCode),onChange:S=>c({...l,primaryPhoneCountryCode:N(S),primaryPhoneCallingCode:N(Vt(S))}),disabled:e,options:i,selectSizeVariant:"small",withSearchInput:!0})})})},Dn=p(O)`
  flex: 1 1 100%;
`,En=({disabled:e,fieldMetadataItem:n,objectMetadataItem:o})=>t(V,{preview:t(Dn,{fieldMetadataItem:n,objectMetadataItem:o}),form:t(wn,{disabled:e,fieldMetadataItem:n})}),ve=({fieldMetadataItem:e,objectMetadataItem:n})=>{const{objectMetadataItems:o}=G(),i=Nt(),{relationFieldMetadataItem:r,relationObjectMetadataItem:u,relationType:c}=Q.useMemo(()=>e?i({fieldMetadataItem:e}):null,[e,i])??{},l=Q.useMemo(()=>u??n??o.filter(Se)[0],[n,o,u]),S=c??v.ONE_TO_MANY;return{disableFieldEdition:r&&!r.isCustom,disableRelationEdition:!!r,initialRelationFieldMetadataItem:r??{icon:l.icon??"IconUsers",label:[v.MANY_TO_MANY,v.MANY_TO_ONE].includes(S)?l.labelPlural:l.labelSingular},initialRelationObjectMetadataItem:l,initialRelationType:S}},Tn=a.object({relation:a.object({field:k().pick({icon:!0,label:!0}).merge(k().pick({name:!0,isLabelSyncedWithName:!0}).partial()),objectMetadataId:a.string().uuid(),type:a.enum(Object.keys(H))})}),On=p.div`
  padding: ${({theme:e})=>e.spacing(4)};
`,Vn=p.div`
  display: grid;
  gap: ${({theme:e})=>e.spacing(4)};
  grid-template-columns: ${({isMobile:e})=>e?"1fr":"1fr 1fr"};
  margin-bottom: ${({theme:e})=>e.spacing(4)};
`,Nn=p.span`
  color: ${({theme:e})=>e.font.color.light};
  display: block;
  font-size: ${({theme:e})=>e.font.size.xs};
  font-weight: ${({theme:e})=>e.font.weight.semiBold};
  margin-bottom: ${({theme:e})=>e.spacing(1)};
`,Ln=p.div`
  display: flex;
  gap: ${({theme:e})=>e.spacing(2)};
  width: 100%;
`,vn=Object.entries(H).filter(([e])=>v.ONE_TO_ONE!==e&&v.MANY_TO_MANY!==e).map(([e,{label:n,Icon:o}])=>({label:n,value:e,Icon:o})),An=({fieldMetadataItem:e,objectMetadataItem:n})=>{const{control:o,watch:i}=b(),{getIcon:r}=et(),{objectMetadataItems:u,findObjectMetadataItemById:c}=G(),{disableFieldEdition:l,disableRelationEdition:S,initialRelationFieldMetadataItem:h,initialRelationObjectMetadataItem:C,initialRelationType:F}=ve({fieldMetadataItem:e,objectMetadataItem:n}),w=c(i("relation.objectMetadataId",C==null?void 0:C.id)),T=i("relation.type",F),L=ye();return y(On,{children:[y(Vn,{isMobile:L,children:[t(f,{name:"relation.type",control:o,defaultValue:F,render:({field:{onChange:d,value:g}})=>t(A,{label:"Relation type",dropdownId:"relation-type-select",fullWidth:!0,disabled:S,value:g,options:vn,onChange:d})}),t(f,{name:"relation.objectMetadataId",control:o,defaultValue:C.id,render:({field:{onChange:d,value:g}})=>t(A,{label:"Object destination",dropdownId:"object-destination-select",fullWidth:!0,disabled:S,value:g,options:u.filter(Se).map(m=>({label:m.labelPlural,value:m.id,Icon:r(m.icon)})),onChange:d})})]}),y(Nn,{children:["Field on"," ",T===v.MANY_TO_ONE?w==null?void 0:w.labelSingular:w==null?void 0:w.labelPlural]}),y(Ln,{children:[t(f,{name:"relation.field.icon",control:o,defaultValue:h.icon,render:({field:{onChange:d,value:g}})=>t(ce,{disabled:l,dropdownId:"field-destination-icon-picker",selectedIconKey:g??void 0,onChange:({iconKey:m})=>d(m),variant:"primary"})}),t(f,{name:"relation.field.label",control:o,defaultValue:h.label,render:({field:{onChange:d,value:g}})=>t(j,{disabled:l,placeholder:"Field name",value:g,onChange:d,fullWidth:!0,maxLength:_t})})]})]})},le=p(O)`
  flex: 1 1 100%;
`,$n=p.div`
  display: flex;
  gap: 6px;
  flex-direction: ${({isMobile:e})=>e?"column":"row"};
`,Rn=p.img`
  transform: ${({flip:e,isMobile:n})=>{let o="";return n&&(o+="rotate(90deg) "),e===!0&&(o+="scaleX(-1)"),o.trim()}};
  margin: auto;
  width: 54px;
`,_n=({fieldMetadataItem:e,objectMetadataItem:n})=>{const{watch:o}=b(),{findObjectMetadataItemById:i}=G(),r=ye(),{initialRelationObjectMetadataItem:u,initialRelationType:c,initialRelationFieldMetadataItem:l}=ve({fieldMetadataItem:e,objectMetadataItem:n}),S=o("relation.objectMetadataId",u==null?void 0:u.id),h=i(S);if(!h)return null;const C=o("relation.type",c),F=H[C];return t(V,{preview:y($n,{isMobile:r,children:[t(le,{fieldMetadataItem:e,shrink:!0,objectMetadataItem:n,relationObjectMetadataItem:h,pluralizeLabel:o("relation.type")===v.MANY_TO_ONE}),t(Rn,{src:F.imageSrc,flip:F.isImageFlipped,alt:F.label,isMobile:r}),t(le,{fieldMetadataItem:{...l,icon:o("relation.field.icon",l.icon),label:o("relation.field.label",l.label)||"Field name",type:s.RELATION},shrink:!0,objectMetadataItem:h,relationObjectMetadataItem:n,pluralizeLabel:o("relation.type")!==v.MANY_TO_ONE})]}),form:t(An,{fieldMetadataItem:e,objectMetadataItem:n})})},xn=a.object({color:tt,id:a.string(),label:a.string().trim().min(1),position:a.number(),value:a.string()}).refine(e=>{try{return P(e.label),!0}catch{return!1}},{message:"Label is not transliterable"}),Ae=a.array(xn).min(1).refine(e=>{const n=e.map(({id:o})=>o);return new Set(n).size===e.length},{message:"Options must have unique ids"}).refine(e=>{const n=e.map(({value:o})=>o);return new Set(n).size===e.length},{message:"Options must have unique values"}).refine(e=>[...e].sort().every((n,o)=>n.position===o),{message:"Options positions must be sequential"}),$e=(e,n=1)=>{const o=`Option ${e.length+n}`;return e.some(r=>r.label===o)?$e(e,n+1):o},In=e=>{var o;const n=$e(e);return{color:At((o=e[e.length-1])==null?void 0:o.color),id:nt(),label:n,position:e.length,value:P(n)}},Pn=(e,n)=>n.type===s.SELECT?N(e)===n.defaultValue:n.type===s.MULTI_SELECT&&Array.isArray(n.defaultValue)?n.defaultValue.includes(N(e)):!1,ie=X,kn=p.div`
  align-items: center;
  display: flex;
  height: ${({theme:e})=>e.spacing(6)};
  padding: ${({theme:e})=>e.spacing(1.5)} 0;
`,jn=p(se)`
  cursor: pointer;
  margin-top: ${({theme:e})=>e.spacing(1)};
  margin-bottom: ${({theme:e})=>e.spacing(1)};

  margin-right: ${({theme:e})=>e.spacing(3.5)};
  margin-left: ${({theme:e})=>e.spacing(3.5)};
`,re=p(j)`
  flex-grow: 1;
  width: 100%;
  & input {
    height: ${({theme:e})=>e.spacing(6)};
  }
`,zn=p(ot)`
  margin-right: ${({theme:e})=>e.spacing(.75)};
`,Wn=p(lt)`
  margin-left: ${({theme:e})=>e.spacing(2)};
`,Bn=({className:e,isDefault:n,onChange:o,onRemove:i,onSetAsDefault:r,onRemoveAsDefault:u,onInputEnter:c,option:l,isNewRow:S})=>{const h=M(),C=`select-color-dropdown-${l.id}`,F=`select-actions-dropdown-${l.id}`,{closeDropdown:w}=J(C),{closeDropdown:T}=J(F),L=()=>{c==null||c()};return y(kn,{className:e,children:[t(zn,{style:{minWidth:h.icon.size.md},size:h.icon.size.md,stroke:h.icon.stroke.sm,color:h.font.color.extraLight}),t(U,{dimension:"width",hideIcon:!0,children:t(re,{value:l.value,onChange:d=>o({...l,value:P(d)}),RightIcon:n?I:void 0,maxLength:ie})}),t(ee,{dropdownId:C,dropdownPlacement:"bottom-start",dropdownHotkeyScope:{scope:C},clickableComponent:t(jn,{colorName:l.color}),dropdownComponents:t(Z,{children:x.map(d=>t(Rt,{onClick:()=>{o({...l,color:d}),w()},color:d,selected:d===l.color},d))})}),t(re,{value:l.label,onChange:d=>{const g=l.value!==P(l.label);o({...l,label:d,value:g?l.value:P(d)})},RightIcon:n?I:void 0,maxLength:ie,onInputEnter:L,autoFocusOnMount:S,autoSelectOnMount:S}),t(ee,{dropdownId:F,dropdownPlacement:"right-start",dropdownHotkeyScope:{scope:F},clickableComponent:t(Wn,{accent:"tertiary",Icon:it}),dropdownComponents:t(rt,{children:y(Z,{children:[n?t(W,{LeftIcon:he,text:"Remove as default",onClick:()=>{u==null||u(),T()}}):t(W,{LeftIcon:I,text:"Set as default",onClick:()=>{r==null||r(),T()}}),!!i&&!n&&t(W,{accent:"danger",LeftIcon:st,text:"Remove option",onClick:()=>{i(),T()}})]})})})]})},q=a.object({defaultValue:Lt(),options:Ae}),K=a.object({defaultValue:vt(),options:Ae});a.union([q,K]);const Mn=p(Y)`
  padding-bottom: ${({theme:e})=>e.spacing(3.5)};
`,Un=p.div`
  color: ${({theme:e})=>e.font.color.light};
  font-size: ${({theme:e})=>e.font.size.xs};
  font-weight: ${({theme:e})=>e.font.weight.semiBold};
  margin-bottom: ${({theme:e})=>e.spacing(1.5)};
  margin-top: ${({theme:e})=>e.spacing(1)};
  width: 100%;
  margin-left: ${({theme:e,isAdvancedModeEnabled:n})=>e.spacing(n?10:0)};
`,Yn=p.div`
  display: flex;
  gap: ${({theme:e})=>e.spacing(2)};
  width: 100%;
`,Gn=p.span`
  color: ${({theme:e})=>e.font.color.light};
  font-size: ${({theme:e})=>e.font.size.xs};
  font-weight: ${({theme:e})=>e.font.weight.semiBold};
  margin-bottom: ${({theme:e})=>e.spacing(1.5)};
  margin-top: ${({theme:e})=>e.spacing(1)};
  width: 100%;
  white-space: nowrap;
`,Xn=p.div`
  display: flex;
`,Hn=p.div`
  border-right: 1px solid ${B.yellow};
  display: flex;

  margin-bottom: ${({theme:e})=>e.spacing(1.5)};
  margin-top: ${({theme:e})=>e.spacing(1)};
`,qn=p(at)`
  margin-right: ${({theme:e})=>e.spacing(.5)};
`,Kn=p(ct)`
  background-color: ${({theme:e})=>e.background.secondary};
  padding: ${({theme:e})=>e.spacing(1)};
`,Qn=p(dt)`
  justify-content: center;
  width: 100%;
`,Jn=({fieldMetadataItem:e})=>{const{initialDefaultValue:n,initialOptions:o}=Oe({fieldMetadataItem:e}),i=ut(pt),{control:r,setValue:u,watch:c,getValues:l}=b(),S=(d,g,m)=>{if(!g.destination)return;const D=mt(d,{fromIndex:g.source.index,toIndex:g.destination.index}).map(($,_)=>({...$,position:_}));m(D)},h=d=>Pn(d,{type:e.type,defaultValue:c("defaultValue")}),C=d=>{if(h(d))return;if(e.type===s.SELECT){u("defaultValue",N(d),{shouldDirty:!0});return}const g=l("defaultValue");e.type===s.MULTI_SELECT&&(Array.isArray(g)||g===null)&&u("defaultValue",[...g??[],N(d)],{shouldDirty:!0})},F=d=>{if(!h(d))return;if(e.type===s.SELECT){u("defaultValue",null,{shouldDirty:!0});return}const g=l("defaultValue");if(e.type===s.MULTI_SELECT&&(Array.isArray(g)||g===null)){const m=g==null?void 0:g.filter(D=>D!==N(d));u("defaultValue",m!=null&&m.length?m:null,{shouldDirty:!0})}},w=()=>{const d=l("options");return[...d,In(d)]},T=()=>{const d=w();u("options",d,{shouldDirty:!0})},L=()=>{const d=w();u("options",d,{shouldDirty:!0})};return y(E,{children:[t(f,{name:"defaultValue",control:r,defaultValue:n,render:()=>t(E,{})}),t(f,{name:"options",control:r,defaultValue:o,render:({field:{onChange:d,value:g}})=>y(E,{children:[y(Mn,{children:[y(Xn,{children:[t(U,{dimension:"width",hideIcon:!0,children:y(Yn,{children:[t(Hn,{children:t(qn,{size:12,color:B.yellow,fill:B.yellow})}),t(Gn,{children:"API values"})]})}),t(Un,{isAdvancedModeEnabled:i,children:"Options"})]}),t(gt,{onDragEnd:m=>S(g,m,d),draggableItems:t(E,{children:g.map((m,D)=>t(ht,{isInsideScrollableContainer:!0,draggableId:m.id,index:D,isDragDisabled:g.length===1,itemComponent:t(Bn,{option:m,isNewRow:D===g.length-1,onChange:$=>{const _=te(g,D,1,$);d(_),$.value!==m.value&&h(m.value)&&(F(m.value),C($.value))},onRemove:()=>{const $=te(g,D,1).map((_,Re)=>({..._,position:Re}));d($)},isDefault:h(m.value),onSetAsDefault:()=>C(m.value),onRemoveAsDefault:()=>F(m.value),onInputEnter:L},m.id)},m.id))})})]}),t(Kn,{children:t(Qn,{title:"Add option",Icon:me,onClick:T})})]})})]})};a.union([q,K]);const Zn=p(O)`
  display: grid;
  flex: 1 1 100%;
`,eo=({fieldMetadataItem:e,objectMetadataItem:n})=>{const{initialOptions:o,initialDefaultValue:i}=Oe({fieldMetadataItem:e}),{watch:r}=b();return t(V,{preview:t(Zn,{fieldMetadataItem:{...e,defaultValue:r("defaultValue",i),options:r("options",o)},objectMetadataItem:n}),form:t(Jn,{fieldMetadataItem:e})})},to=a.object({type:a.literal(s.BOOLEAN)}).merge(Ht),no=a.object({type:a.literal(s.CURRENCY)}).merge(on),oo=a.object({type:a.literal(s.DATE)}).merge(Le),lo=a.object({type:a.literal(s.DATE_TIME)}).merge(Le),io=a.object({type:a.literal(s.RELATION)}).merge(Tn),ro=a.object({type:a.literal(s.SELECT)}).merge(q),so=a.object({type:a.literal(s.MULTI_SELECT)}).merge(K),ao=a.object({type:a.literal(s.NUMBER)}).merge(yn),co=a.object({type:a.literal(s.TEXT)}).merge(Zt),uo=a.object({type:a.literal(s.ADDRESS)}).merge(Ut),po=a.object({type:a.literal(s.PHONES)}).merge(Cn),go=a.object({type:a.enum(Object.keys(St(yt,[s.BOOLEAN,s.CURRENCY,s.RELATION,s.SELECT,s.MULTI_SELECT,s.DATE,s.DATE_TIME,s.NUMBER,s.ADDRESS,s.PHONES,s.TEXT])))}),ho=a.discriminatedUnion("type",[to,no,oo,lo,io,ro,so,ao,co,uo,po,go]),mo=p(O)`
  flex: 1 1 100%;
`,So=[s.ARRAY,s.ADDRESS,s.BOOLEAN,s.CURRENCY,s.DATE,s.DATE_TIME,s.EMAILS,s.FULL_NAME,s.LINKS,s.MULTI_SELECT,s.NUMBER,s.PHONES,s.RATING,s.RAW_JSON,s.RELATION,s.SELECT,s.TEXT],Oo=({fieldMetadataItem:e,objectMetadataItem:n})=>So.includes(e.type)?e.type===s.BOOLEAN?t(Qt,{fieldMetadataItem:e,objectMetadataItem:n}):e.type===s.CURRENCY?t(an,{fieldMetadataItem:e,objectMetadataItem:n}):e.type===s.DATE||e.type===s.DATE_TIME?t(un,{fieldMetadataItem:e,objectMetadataItem:n}):e.type===s.RELATION?t(_n,{fieldMetadataItem:e,objectMetadataItem:n}):e.type===s.NUMBER?t(Fn,{fieldMetadataItem:e,objectMetadataItem:n}):e.type===s.TEXT?t(nn,{fieldMetadataItem:e,objectMetadataItem:n}):e.type===s.ADDRESS?t(Xt,{fieldMetadataItem:e,objectMetadataItem:n}):e.type===s.PHONES?t(En,{fieldMetadataItem:e,objectMetadataItem:n}):e.type===s.SELECT||e.type===s.MULTI_SELECT?t(eo,{fieldMetadataItem:e,objectMetadataItem:n}):t(V,{preview:t(mo,{fieldMetadataItem:e,objectMetadataItem:n})}):null,Vo=e=>a.object({}).merge(It(e)).merge(xt()).merge(Ft).and(ho);export{_t as F,To as S,Oo as a,Eo as b,Vo as s};
