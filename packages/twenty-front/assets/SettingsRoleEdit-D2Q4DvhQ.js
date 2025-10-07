import{L as ne,a as d,dQ as le,M as ae,j as t,af as B,dL as E,dR as ie,K as se,dS as oe,n,i,dT as _,d0 as re,dU as de,bb as H,dV as ce,dW as b,b as v,H as M,aq as pe,X as z,as as x,ad as F,bc as ge,bC as he,d3 as ue,r as C,dX as Se,aA as me,dY as ye,dZ as fe,d4 as be,dw as Ie,Y as G,d_ as Re,ac as K,d1 as Te,R as Ce,d$ as xe,d6 as Ae,d5 as $e,B as Ne,ai as ve,ag as _e,ah as ke,e0 as Pe,t as N,$ as Ee,ce as Me,e1 as De,e2 as Oe,s as W,cf as we}from"./index-BzerUb1B.js";import{S as je}from"./SettingsPageContainer-VijhEKua.js";import{S as Le}from"./SubMenuTopBarContainer-DvhK9_Ug.js";import{T as R,S as A,a as I}from"./Table-_VNdQp1e.js";import{S}from"./TableHeader-BaKK11nR.js";import{T as We}from"./TextArea-DEwBENQ4.js";import{S as Ue}from"./SettingsCard-DcAuUKAo.js";import{I as Be}from"./IconUserPlus-DYPJObtc.js";import{I as He}from"./IconLockOpen-A0gm2fJv.js";const ze=({accent:e="default",className:l,iconButtons:r,isIconDisplayedOnHoverOnly:o=!0,onClick:a,onMouseEnter:p,onMouseLeave:g,testId:h,avatar:c,hasSubMenu:m=!1,text:k})=>{const $=ne(),T=Array.isArray(r)&&r.length>0;return d(oe,{"data-testid":h??void 0,onClick:y=>{a&&(y.preventDefault(),y.stopPropagation(),a==null||a(y))},className:l,accent:e,isIconDisplayedOnHoverOnly:o,onMouseEnter:p,onMouseLeave:g,children:[d(le,{children:[ae(c)&&t(B,{placeholder:c.placeholder,avatarUrl:c.avatarUrl,placeholderColorSeed:c.placeholderColorSeed,size:c.size,type:c.type}),t(E,{text:k??""})]}),t("div",{className:"hoverable-buttons",children:T&&t(ie,{iconButtons:r,size:"small"})}),m&&t(se,{size:$.icon.size.sm,color:$.font.color.tertiary})]})},Fe=n(R)`
  display: flex;
`,Ge=n(S)`
  flex: 1;
`,Ke=n(S)`
  align-items: center;
  display: flex;
  justify-content: flex-end;
  padding-right: ${({theme:e})=>e.spacing(4)};
`,Ye=n(A)`
  margin-bottom: ${({theme:e})=>e.spacing(2)};
`,Qe=({className:e,allPermissions:l})=>t(Ye,{className:e,children:d(Fe,{children:[t(Ge,{children:i._({id:"6YtxFj"})}),t(Ke,{"aria-label":i._({id:"7L01XJ"}),children:t(_,{checked:l,disabled:!0})})]})}),Xe=n(R)`
  align-items: center;
  display: flex;
  height: ${({theme:e})=>e.spacing(8)};
`,qe=n(S)`
  flex: 1;
  padding-left: ${({theme:e})=>e.spacing(2)};
`,Je=n(S)`
  align-items: center;
  display: flex;
  justify-content: flex-end;
  padding-right: ${({theme:e})=>e.spacing(4)};
`,Ve=n(A)`
  margin-bottom: ${({theme:e})=>e.spacing(2)};
`,Ze=n(S)`
  flex: 1;
`,et=({className:e,allPermissions:l})=>t(Ve,{className:e,children:d(Xe,{children:[t(qe,{children:i._({id:"6YtxFj"})}),t(Ze,{children:i._({id:"+zy2Nq"})}),t(Je,{"aria-label":i._({id:"7L01XJ"}),children:t(_,{checked:l,disabled:!0})})]})}),Y=n.span`
  color: ${({theme:e})=>e.font.color.primary};
`,tt=n(Y)`
  color: ${({theme:e})=>e.font.color.secondary};
`,U=n(I)`
  align-items: center;
  display: flex;
  flex: 1;
  gap: ${({theme:e})=>e.spacing(2)};
  padding-left: ${({theme:e})=>e.spacing(2)};
`,nt=n(I)`
  align-items: center;
  display: flex;
  justify-content: flex-end;
  padding-right: ${({theme:e})=>e.spacing(4)};
`,lt=n(R)`
  align-items: center;
  display: flex;
`,at=({permission:e})=>d(lt,{children:[t(U,{children:t(Y,{children:e.label})}),t(U,{children:t(tt,{children:e.type})}),t(nt,{children:t(_,{checked:e.value,disabled:!0})})]},e.key),it=n.div`
  align-items: center;
  background: ${({theme:e})=>e.color.blue10};
  border: 1px solid ${({theme:e})=>e.color.blue30};
  border-radius: ${({theme:e})=>e.border.radius.sm};
  display: flex;
  height: ${({theme:e})=>e.spacing(4)};
  justify-content: center;
  width: ${({theme:e})=>e.spacing(4)};
`,st=n.div`
  align-items: center;
  display: flex;
  color: ${({theme:e})=>e.color.blue};
  justify-content: center;
`,ot=n.span`
  color: ${({theme:e})=>e.font.color.primary};
`,rt=n(I)`
  align-items: center;
  display: flex;
  flex: 1;
  gap: ${({theme:e})=>e.spacing(2)};
  padding-left: ${({theme:e})=>e.spacing(2)};
`,dt=n(I)`
  align-items: center;
  display: flex;
  justify-content: flex-end;
  padding-right: ${({theme:e})=>e.spacing(4)};
`,ct=n(R)`
  align-items: center;
  display: flex;
`,pt=({permission:e})=>d(ct,{children:[d(rt,{children:[t(it,{children:t(st,{children:e.icon})}),t(ot,{children:e.label})]}),t(dt,{children:t(_,{checked:e.value,disabled:!0})})]},e.key),gt=n.div`
  display: flex;
  flex-direction: column;
  gap: ${({theme:e})=>e.spacing(8)};
`,ht=({role:e})=>{const l=[{key:"seeRecords",label:"See Records on All Objects",icon:t(re,{size:14}),value:e.canReadAllObjectRecords},{key:"editRecords",label:"Edit Records on All Objects",icon:t(de,{size:14}),value:e.canUpdateAllObjectRecords},{key:"deleteRecords",label:"Delete Records on All Objects",icon:t(H,{size:14}),value:e.canSoftDeleteAllObjectRecords},{key:"destroyRecords",label:"Destroy Records on All Objects",icon:t(ce,{size:14}),value:e.canDestroyAllObjectRecords}],r=[{key:b.API_KEYS_AND_WEBHOOKS,label:"API Keys and Webhooks",type:"Developer",value:e.canUpdateAllSettings},{key:b.ROLES,label:"Roles",type:"Members",value:e.canUpdateAllSettings},{key:b.WORKSPACE,label:"Workspace Settings",type:"General",value:e.canUpdateAllSettings},{key:b.WORKSPACE_USERS,label:"Workspace Users",type:"Members",value:e.canUpdateAllSettings},{key:b.DATA_MODEL,label:"Data Model",type:"Data Model",value:e.canUpdateAllSettings},{key:b.ADMIN_PANEL,label:"Admin Panel",type:"Admin Panel",value:e.canUpdateAllSettings},{key:b.SECURITY,label:"Security Settings",type:"Security",value:e.canUpdateAllSettings}];return d(gt,{children:[d(v,{children:[t(M,{title:i._({id:"B3toQF"}),description:i._({id:"09tRFp"})}),t(Qe,{allPermissions:!0}),l.map(o=>t(pt,{permission:o},o.key))]}),d(v,{children:[t(M,{title:i._({id:"Tz0i8g"}),description:i._({id:"p8fNBm"})}),t(et,{allPermissions:e.canUpdateAllSettings}),r.map(o=>t(at,{permission:o},o.key))]})]})},ut=n.div`
  display: flex;
  gap: ${({theme:e})=>e.spacing(2)};
  margin-bottom: ${({theme:e})=>e.spacing(2)};
  width: 100%;
`,St=n.div`
  display: flex;
  flex-direction: column;
`,mt=({role:e})=>d(x,{children:[d(ut,{children:[t(St,{children:t(pe,{disabled:!0,selectedIconKey:"IconUser",onChange:()=>{}})}),t(z,{value:e.label,disabled:!0,fullWidth:!0})]}),t(We,{minRows:4,placeholder:i._({id:"Q9pNST"}),value:e.description||"",disabled:!0})]}),yt=n.div`
  margin-top: ${({theme:e})=>e.spacing(2)};
`,ft=({mode:e,selectedWorkspaceMember:l,onRoleClick:r})=>{var g;const o=e==="assign",a=!!l.role,p=l.name;return o&&a?d(x,{children:[i._({id:"WN9tFl",values:{workspaceMemberName:p}}),t(yt,{children:t(Ue,{title:((g=l.role)==null?void 0:g.label)||"",Icon:t(F,{}),onClick:()=>l.role&&r(l.role.id)})})]}):o?i._({id:"3SRf5B"}):i._({id:"yHIStW"})},bt=({mode:e,selectedWorkspaceMember:l,isOpen:r,onClose:o,onConfirm:a,onRoleClick:p})=>{const g=e==="assign",h=!!l.role,c=l.name,m=g?i._({id:"9ch9Mz",values:{workspaceMemberName:c}}):i._({id:"ken+P9",values:{workspaceMemberName:c}});return t(ge,{isOpen:r,setIsOpen:o,title:m,subtitle:t(ft,{mode:e,selectedWorkspaceMember:l,onRoleClick:p}),onConfirmClick:a,deleteButtonText:g?i._({id:"7VpPHA"}):i._({id:"t/YqKh"}),confirmButtonAccent:g&&!h?"blue":"danger"})},It=n(A)`
  margin-bottom: ${({theme:e})=>e.spacing(2)};
`,Rt=({className:e})=>t(It,{className:e,children:d(R,{gridAutoColumns:"150px 1fr 1fr",children:[t(S,{children:i._({id:"6YtxFj"})}),t(S,{children:i._({id:"O3oNi5"})}),t(S,{align:"right","aria-label":i._({id:"7L01XJ"})})]})}),Tt=n(A)`
  margin-top: ${({theme:e})=>e.spacing(.5)};
`,Ct=n.div`
  display: flex;
  align-items: center;
  margin-right: ${({theme:e})=>e.spacing(2)};
`,xt=n.div`
  align-items: center;
  display: flex;
  flex-direction: row;
  margin-left: ${({theme:e})=>e.spacing(3)};
`,At=({workspaceMember:e,onRemove:l})=>{const r=o=>{o.stopPropagation(),l(e.id)};return t(Tt,{children:d(R,{gridAutoColumns:"150px 1fr 1fr",children:[d(I,{children:[t(Ct,{children:t(B,{avatarUrl:e.avatarUrl,placeholderColorSeed:e.id,placeholder:e.name.firstName??"",type:"rounded",size:"md"})}),t(E,{text:`${e.name.firstName} ${e.name.lastName}`})]}),t(I,{children:t(E,{text:e.userEmail})}),t(I,{align:"right",children:t(xt,{children:t(he,{onClick:r,variant:"tertiary",size:"medium",Icon:H,"aria-label":i._({id:"t/YqKh"})})})})]})})},$t=({loading:e,searchFilter:l,filteredWorkspaceMembers:r,onSelect:o})=>e?null:!r.length&&l.length>0?t(ue,{disabled:!0,text:i._({id:"MA3x23"})}):t(x,{children:r.map(a=>t(ze,{onClick:()=>o(a),avatar:{type:"rounded",size:"md",placeholder:a.name.firstName??"",placeholderColorSeed:a.id},text:`${a.name.firstName} ${a.name.lastName}`},a.id))}),Nt=({excludedWorkspaceMemberIds:e,onSelect:l})=>{const[r,o]=C.useState(""),{loading:a,records:p}=Se({objectNameSingular:me.WorkspaceMember,searchInput:r}),g=(p==null?void 0:p.filter(c=>!e.includes(c.id)))??[];return d(Ie,{children:[t(ye,{value:r,onChange:c=>{o(c.target.value)},placeholder:"Search"}),t(fe,{}),t(be,{children:t($t,{loading:a,searchFilter:r,filteredWorkspaceMembers:g,onSelect:l})})]})},vt=n(v)`
  ${({hasRows:e,theme:l})=>e?`
    border-top: 1px solid ${l.border.color.light};
    margin-top: ${l.spacing(2)};
    padding-top: ${l.spacing(4)};
  `:`
    margin-top: ${l.spacing(8)};
  `}
  display: flex;
  justify-content: flex-end;
`,_t=n.div`
  margin: ${({theme:e})=>e.spacing(2)} 0;
`,kt=n(z)`
  input {
    background: ${({theme:e})=>e.background.transparent.lighter};
    border: 1px solid ${({theme:e})=>e.border.color.medium};

    &:hover {
      border: 1px solid ${({theme:e})=>e.border.color.medium};
    }
  }
`,Pt=({role:e})=>{var O;const l=G(),[r]=Re({refetchQueries:[Pe]}),[o,a]=C.useState(null),[p,g]=C.useState(null),{data:h}=K(),{closeDropdown:c}=Te("role-member-select"),[m,k]=C.useState(""),$=Ce(xe),T=new Map;(O=h==null?void 0:h.getRoles)==null||O.forEach(s=>{s.workspaceMembers.forEach(f=>{T.set(f.id,{id:s.id,label:s.label})})});const P=m?e.workspaceMembers.filter(s=>{var w,j,L;const f=m.toLowerCase(),Z=((w=s.name.firstName)==null?void 0:w.toLowerCase())||"",ee=((j=s.name.lastName)==null?void 0:j.toLowerCase())||"",te=((L=s.userEmail)==null?void 0:L.toLowerCase())||"";return Z.includes(f)||ee.includes(f)||te.includes(f)}):e.workspaceMembers,y=()=>{a(null),g(null)},Q=s=>{const f=T.get(s.id);g({id:s.id,name:`${s.name.firstName} ${s.name.lastName}`,role:f}),a("assign"),c()},X=s=>{g({id:s.id,name:`${s.name.firstName} ${s.name.lastName}`,role:T.get(s.id)}),a("remove")},q=async()=>{!p||!o||(await r({variables:{workspaceMemberId:p.id,roleId:o==="assign"?e.id:null}}),y())},J=s=>{l(N.RoleDetail,{roleId:s}),y()},V=s=>{k(s)},D=e.workspaceMembers.length===$.length;return d(x,{children:[d(v,{children:[t(M,{title:i._({id:"OItM/o"}),description:i._({id:"xPfDRx"})}),t(_t,{children:t(kt,{value:m,onChange:V,placeholder:i._({id:"t3n1Qy"}),fullWidth:!0,LeftIcon:Ae,sizeVariant:"lg"})}),d(A,{children:[t(Rt,{}),P.map(s=>t(At,{workspaceMember:s,onRemove:()=>X(s)},s.id))]})]}),t(vt,{hasRows:P.length>0,children:t($e,{dropdownId:"role-member-select",dropdownHotkeyScope:{scope:"roleAssignment"},clickableComponent:d(x,{children:[t("div",{id:"assign-member",children:t(Ne,{Icon:ve,title:i._({id:"2y2quh"}),variant:"secondary",size:"small",disabled:D})}),t(_e,{anchorSelect:"#assign-member",content:i._({id:"DL8pzn"}),delay:ke.noDelay,hidden:!D})]}),dropdownComponents:t(Nt,{excludedWorkspaceMemberIds:e.workspaceMembers.map(s=>s.id),onSelect:Q})})}),o&&p&&t(bt,{mode:o,selectedWorkspaceMember:p,isOpen:!0,onClose:y,onConfirm:q,onRoleClick:J})]})},Et=n.div`
  flex: 1;
  width: 100%;
  padding-left: 0;
`,Mt=n.div`
  display: flex;
  align-items: center;
  gap: ${({theme:e})=>e.spacing(2)};
`,Dt=n(F)`
  color: ${({theme:e})=>e.font.color.primary};
`,u={COMPONENT_INSTANCE_ID:"settings-role-detail-tabs",TABS_IDS:{ASSIGNMENT:"assignment",PERMISSIONS:"permissions",SETTINGS:"settings"}},Ft=()=>{const{roleId:e=""}=Ee(),l=G(),{data:r,loading:o}=K({fetchPolicy:"network-only"}),a=r==null?void 0:r.getRoles.find(c=>c.id===e),{activeTabId:p}=Me(u.COMPONENT_INSTANCE_ID);if(C.useEffect(()=>{!o&&!a&&l(N.Roles)},[a,l,o]),!a)return null;const g=[{id:u.TABS_IDS.ASSIGNMENT,title:i._({id:"0dtKl9"}),Icon:Be,hide:!1},{id:u.TABS_IDS.PERMISSIONS,title:i._({id:"9cDpsw"}),Icon:He,hide:!1},{id:u.TABS_IDS.SETTINGS,title:i._({id:"Tz0i8g"}),Icon:De,hide:!1}],h=()=>{switch(p){case u.TABS_IDS.ASSIGNMENT:return t(Pt,{role:a});case u.TABS_IDS.PERMISSIONS:return t(ht,{role:a});case u.TABS_IDS.SETTINGS:return t(mt,{role:a});default:return null}};return t(Le,{title:d(Mt,{children:[t(Dt,{size:16}),t(Oe,{title:a.label})]}),links:[{children:"Workspace",href:W(N.Workspace)},{children:"Roles",href:W(N.Roles)},{children:a.label}],children:d(je,{children:[t(we,{tabListInstanceId:u.COMPONENT_INSTANCE_ID,tabs:g,className:"tab-list"}),t(Et,{children:h()})]})})};export{u as SETTINGS_ROLE_DETAIL_TABS,Ft as SettingsRoleEdit};
