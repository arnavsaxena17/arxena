import{n as t,b as h,K as u,h as $,L as v,Y as T,ac as x,j as i,T as o,s as b,t as g,a as l,H as R,ad as C,ae as z,G as _,af as A,ag as I,ah as j,B as H,ai as N}from"./index-DB0OKRlD.js";import{S as P}from"./SettingsPageContainer-C2QLAmOr.js";import{S as U}from"./SubMenuTopBarContainer-9LB8hreq.js";import{S as p,T as m,a as d}from"./Table-cIS0B5sH.js";import{S as c}from"./TableHeader-DXVgF--L.js";const B=t(p)`
  margin-top: ${({theme:e})=>e.spacing(.5)};
`,L=t(m)`
  &:hover {
    background: ${({theme:e})=>e.background.transparent.light};
    cursor: pointer;
  }
`,Y=t.div`
  align-items: center;
  display: flex;
  gap: ${({theme:e})=>e.spacing(2)};
`,k=t.div`
  align-items: center;
  display: flex;
  gap: ${({theme:e})=>e.spacing(1)};
`,F=t.div`
  align-items: center;
  display: flex;
  margin-right: ${({theme:e})=>e.spacing(1)};

  > * {
    margin-left: -5px;

    &:first-of-type {
      margin-left: 0;
    }
  }
`,G=t(p)`
  margin-bottom: ${({theme:e})=>e.spacing(2)};
`,K=t(h)`
  border-top: 1px solid ${({theme:e})=>e.border.color.light};
  margin-top: ${({theme:e})=>e.spacing(2)};
  padding-top: ${({theme:e})=>e.spacing(4)};
  display: flex;
  justify-content: flex-end;
`,D=t(u)`
  color: ${({theme:e})=>e.font.color.tertiary};
`,E=t.div`
  border: 0px;
`,J=t.div`
  color: ${({theme:e})=>e.font.color.primary};
  font-size: ${({theme:e})=>e.font.size.md};
`,X=()=>{const{i18n:e,_:Q}=$(),s=v(),y=T(),{data:r,loading:S}=x({fetchPolicy:"network-only"}),f=a=>{y(g.RoleDetail,{roleId:a})};return i(U,{title:e._({id:"5dJK4M"}),links:[{children:i(o,{id:"pmUArF"}),href:b(g.Workspace)},{children:i(o,{id:"5dJK4M"})}],children:i(P,{children:l(h,{children:[i(R,{title:e._({id:"Hm90t3"}),description:e._({id:"rfYmIr"})}),l(B,{children:[i(G,{children:l(m,{children:[i(c,{children:i(o,{id:"6YtxFj"})}),i(c,{align:"right",children:i(o,{id:"lxQ+5m"})}),i(c,{align:"right"})]})}),!S&&(r==null?void 0:r.getRoles.map(a=>l(L,{onClick:()=>f(a.id),children:[i(d,{children:l(Y,{children:[i(C,{size:s.icon.size.md}),a.label,!a.isEditable&&i(z,{size:s.icon.size.sm})]})}),i(d,{align:"right",children:l(k,{children:[i(F,{children:a.workspaceMembers.slice(0,5).map(n=>l(_.Fragment,{children:[i(E,{id:`avatar-${n.id}`,children:i(A,{avatarUrl:n.avatarUrl,placeholderColorSeed:n.id,placeholder:n.name.firstName??"",type:"rounded",size:"md"})}),i(I,{anchorSelect:`#avatar-${n.id}`,content:`${n.name.firstName} ${n.name.lastName}`,noArrow:!0,place:"top",positionStrategy:"fixed",delay:j.shortDelay})]},n.id))}),i(J,{children:a.workspaceMembers.length})]})}),i(d,{align:"right",children:i(D,{size:s.icon.size.md})})]},a.id)))]}),i(K,{children:i(H,{Icon:N,title:e._({id:"RoyYUE"}),variant:"secondary",size:"small",soon:!0})})]})})})};export{X as SettingsRoles};
