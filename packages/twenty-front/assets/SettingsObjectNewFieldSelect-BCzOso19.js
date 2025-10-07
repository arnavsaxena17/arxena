import{n as l,bN as $,d3 as k,B as L,d1 as A,Y as B,dv as R,$ as O,bB as z,L as E,a as h,j as t,dw as U,d4 as Y,M as g,d5 as G,t as C,V as y,dx as H,dy as I,bY as W,r as F,X,dz as j,d6 as Q,H as Z,bn as q,s as N,W as J,as as K,a6 as d,U as T,Z as M,a0 as ee,a1 as te,a2 as ne,a3 as oe,a5 as se,a7 as re}from"./index-DB0OKRlD.js";import{S as le}from"./SettingsPageContainer-C2QLAmOr.js";import{S as ie}from"./SettingsCard-CiBwey5e.js";import{S as V}from"./index-tPSkSaW_.js";import{S as ae}from"./SubMenuTopBarContainer-9LB8hreq.js";const ce=l.div`
  align-items: center;
  color: ${({theme:e})=>e.font.color.tertiary};
  cursor: default;
  display: flex;
  font-size: ${({theme:e})=>e.font.size.md};
`,ue=l.div`
  position: relative;
  width: 100%;
`,de=l($)`
  color: ${({theme:e})=>e.font.color.primary};
  position: absolute;
  right: ${({theme:e})=>e.spacing(1.5)};
  top: 50%;
  transform: translateY(-50%);
`,m=l.div`
  cursor: ${({disabled:e})=>e?"not-allowed":"pointer"};
  width: 100%;
`,v=l(k)`
  background: ${({theme:e,selected:n})=>n?e.background.quaternary:"transparent"};
  opacity: ${({disabled:e})=>e?.5:1};
  pointer-events: ${({disabled:e})=>e?"none":"auto"};

  &:hover {
    background: ${({theme:e,disabled:n})=>n?"transparent":e.background.tertiary};
  }
`,pe=l.span`
  margin-left: ${({theme:e})=>e.spacing(2)};
`,D=l(L)`
  color: ${({theme:e})=>e.font.color.primary};
  padding-right: ${({theme:e})=>e.spacing(6)};
`,Se=()=>{const e="settings-object-new-field-breadcrumb-dropdown",{closeDropdown:n}=A(e),o=B(),s=R(),{objectNamePlural:i=""}=O(),[a]=z(),c=E(),r=a.get("fieldType"),S=s.pathname.includes("/configure"),f=b=>{b==="configure"&&g(r)?o(C.ObjectNewFieldConfigure,{objectNamePlural:i},{fieldType:r}):o(C.ObjectNewFieldSelect,{objectNamePlural:i},r?{fieldType:r}:void 0),n()};return h(ce,{children:["New Field ",t(pe,{children:"-"}),t(G,{dropdownPlacement:"bottom-start",dropdownId:e,clickableComponent:h(ue,{children:[t(de,{size:c.icon.size.md}),S?t(D,{variant:"tertiary",title:"2. Configure"}):t(D,{variant:"tertiary",title:"1. Type"})]}),dropdownComponents:t(U,{children:h(Y,{children:[t(m,{children:t(v,{text:"1. Type",onClick:()=>f("select"),selected:!S})}),t(m,{disabled:!g(r),children:t(v,{text:"2. Configure",onClick:()=>f("configure"),selected:S,disabled:!g(r)})})]})}),dropdownHotkeyScope:{scope:e}})]})},he=["Basic","Relation","Advanced"],fe={Basic:"All the basic field types you need to start",Advanced:"More advanced fields for advanced projects",Relation:"Create a relation with another object"},ge=({fieldMetadataItem:e})=>{const n=(e==null?void 0:e.defaultValue)??!0,{resetField:o}=y();return{initialDefaultValue:n,resetDefaultValueField:()=>{o("defaultValue",{defaultValue:n})}}},Ce=e=>`'${e}'`,ye=({fieldMetadataItem:e})=>{var c,r;const n=((c=e==null?void 0:e.defaultValue)==null?void 0:c.amountMicros)??null,o=((r=e==null?void 0:e.defaultValue)==null?void 0:r.currencyCode)??Ce(H.USD),s={amountMicros:n,currencyCode:o},{resetField:i}=y();return{initialAmountMicrosValue:n,initialCurrencyCodeValue:o,initialDefaultValue:s,resetDefaultValueField:()=>i("defaultValue",{defaultValue:s})}},be=e=>{const n=/^\d/.test(e)?`OPT${e}`:e,o=I(n,{trim:!0,separator:"_",allowedChars:"a-zA-Z0-9_"});if(o==="")throw new Error("Invalid label");return o.toUpperCase()},Fe={color:"green",id:W(),label:"Option 1",position:0,value:be("Option 1")},we=({fieldMetadataItem:e})=>{const n=(e==null?void 0:e.defaultValue)??null,o=F.useMemo(()=>{var a;return(a=e==null?void 0:e.options)!=null&&a.length?[...e.options].sort((c,r)=>c.position-r.position):[Fe]},[e==null?void 0:e.options]),{resetField:s}=y();return{initialDefaultValue:n,initialOptions:o,resetDefaultValueField:()=>s("defaultValue",{defaultValue:n})}},Te=l.div`
  display: flex;
  flex-direction: column;
  gap: inherit;
  width: 100%;
`,Ve=l.div`
  display: flex;
  gap: ${({theme:e})=>e.spacing(2)};
  justify-content: flex-start;
  flex-wrap: wrap;
  width: 100%;
`,me=l.div`
  display: flex;

  position: relative;
  width: calc(50% - ${({theme:e})=>e.spacing(1)});
`,ve=l(X)`
  width: 100%;
`,De=({excludedFieldTypes:e=[],fieldMetadataItem:n,objectNamePlural:o})=>{const s=E(),{control:i,setValue:a}=y(),[c,r]=F.useState(""),S=Object.entries(j).filter(([p,u])=>!e.includes(p)&&u.label.toLowerCase().includes(c.toLowerCase())),{resetDefaultValueField:f}=ge({fieldMetadataItem:n}),{resetDefaultValueField:b}=ye({fieldMetadataItem:n}),{resetDefaultValueField:_}=we({fieldMetadataItem:n}),x=p=>{switch(p){case d.BOOLEAN:f();break;case d.CURRENCY:b();break;case d.SELECT:case d.MULTI_SELECT:_();break}};return h(K,{children:[" ",t(V,{children:t(ve,{LeftIcon:Q,placeholder:"Search a type",value:c,onChange:r})}),t(J,{name:"type",control:i,render:()=>t(Te,{children:he.map(p=>h(V,{children:[t(Z,{title:p,description:fe[p]}),t(Ve,{children:S.filter(([,u])=>u.category===p).map(([u,w])=>t(me,{children:t(q,{to:N(C.ObjectNewFieldConfigure,{objectNamePlural:o},{fieldType:u}),fullWidth:!0,onClick:()=>{a("type",u),x(u)},children:t(ie,{Icon:t(w.Icon,{size:s.icon.size.xl,stroke:s.icon.stroke.sm}),title:w.label},u)})},u))})]},p))})})]})},P=T.object({type:T.enum(Object.keys(j))}),Oe=()=>{const e=M(),{objectNamePlural:n=""}=O(),{findActiveObjectMetadataItemByNamePlural:o}=ee(),s=o(n),i=te({resolver:ne(P),defaultValues:{type:d.TEXT}}),a=[d.NUMERIC,d.RICH_TEXT,d.RICH_TEXT_V2,d.ACTOR].filter(g);return F.useEffect(()=>{s||e(oe.NotFound)},[s,e]),s?t(re,{children:t(se,{...i,children:t(ae,{title:"1. Select a field type",links:[{children:"Workspace",href:"/settings/workspace"},{children:"Objects",href:"/settings/objects"},{children:s.labelPlural,href:N(C.ObjectDetail,{objectNamePlural:n})},{children:t(Se,{})}],children:t(le,{children:t(De,{objectNamePlural:n,excludedFieldTypes:a})})})})}):null},xe=Object.freeze(Object.defineProperty({__proto__:null,SettingsObjectNewFieldSelect:Oe,settingsDataModelFieldTypeFormSchema:P},Symbol.toStringTag,{value:"Module"}));export{Se as S,Ce as a,ye as b,be as c,we as d,xe as e,P as s,ge as u};
