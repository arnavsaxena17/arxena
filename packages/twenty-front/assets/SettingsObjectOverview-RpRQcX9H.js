import{L as j,a0 as U,r as k,cG as _,M as v,bj as z,j as t,as as B,n as p,R as V,cH as J,bA as N,a as b,bD as E,cI as H,cJ as L,aE as X,bF as K,cK as F,s as Y,t as W,cL as Q,bM as q,bN as Z,cM as ee,cN as te,cO as ne,cP as oe,cQ as ie,cR as ae,cS as re,B as se,cT as ce,cU as le,cV as de,ai as ge,cW as pe,ae as he,cX as ue,cY as fe}from"./index-DB0OKRlD.js";import{g as me,S as be}from"./getObjectTypeLabel-D2SyX39N.js";import{I as ye}from"./IconMaximize-Bu8-vhNV.js";import{I as we}from"./IconLockOpen-DcWfx3pk.js";import{S as xe}from"./SubMenuTopBarContainer-9LB8hreq.js";const $e=({setEdges:e,setNodes:c})=>{const h=j(),{activeObjectMetadataItems:o}=U();return k.useEffect(()=>{var y,n;const r=new _.graphlib.Graph;r.setGraph({rankdir:"LR"}),r.setDefaultEdgeLabel(()=>({}));const i=[],s=[];let u=0;for(const l of o){s.push({id:l.namePlural,width:220,height:100,position:{x:u*300,y:0},data:l,type:"object"}),r.setNode(l.namePlural,{width:220,height:100});for(const a of l.fields)if(v(a.relationDefinition)&&v(o.find(d=>{var g;return d.id===((g=a.relationDefinition)==null?void 0:g.targetObjectMetadata.id)}))){const d=(y=a.relationDefinition)==null?void 0:y.sourceObjectMetadata.namePlural,g=(n=a.relationDefinition)==null?void 0:n.targetObjectMetadata.namePlural;i.push({id:`${d}-${g}`,source:l.namePlural,sourceHandle:`${a.id}-right`,target:a.relationDefinition.targetObjectMetadata.namePlural,targetHandle:`${a.relationDefinition.targetObjectMetadata}-left`,type:"smoothstep",style:{strokeWidth:1,stroke:h.color.gray},markerEnd:"marker",markerStart:"marker",data:{sourceField:a.id,targetField:a.relationDefinition.targetFieldMetadata.id,relation:a.relationDefinition.direction,sourceObject:d,targetObject:g}}),!z(d)&&!z(g)&&r.setEdge(d,g)}u++}_.layout(r),s.forEach(l=>{const a=r.node(l.id);l.position={x:a.x-l.width/2,y:a.y-l.height/2}}),c(s),e(i)},[o,e,c,h]),t(B,{})},Oe=p.div`
  align-items: center;
  display: flex;
  gap: ${({theme:e})=>e.spacing(2)};
  position: relative;
  width: 100%;
  padding: 0 ${({theme:e})=>e.spacing(2)};
`,ke=p.div`
  color: ${({theme:e})=>e.font.color.primary};
`,ve=({field:e})=>{var u,y,n,l,a;const c=V(J),{getIcon:h}=N(),o=j(),r=(u=e.relationDefinition)==null?void 0:u.targetObjectMetadata.id,i=c.find(d=>d.id===r),s=h(i==null?void 0:i.icon);return b(Oe,{children:[s&&t(s,{size:o.icon.size.md}),t(ke,{children:(i==null?void 0:i.labelPlural)??""}),t(L,{type:((y=e.relationDefinition)==null?void 0:y.direction)===E.ONE_TO_MANY?"source":"target",position:H.Right,id:`${e.id}-right`,className:((n=e.relationDefinition)==null?void 0:n.direction)===E.ONE_TO_MANY?"right-handle source-handle":"right-handle target-handle"}),t(L,{type:((l=e.relationDefinition)==null?void 0:l.direction)===E.ONE_TO_MANY?"source":"target",position:H.Left,id:`${e.id}-left`,className:((a=e.relationDefinition)==null?void 0:a.direction)===E.ONE_TO_MANY?"left-handle source-handle":"left-handle target-handle"})]})},Se=p.div`
  align-items: center;
  display: flex;
  gap: ${({theme:e})=>e.spacing(2)};
  position: relative;
  width: 100%;
  padding: 0 ${({theme:e})=>e.spacing(2)};
`,Ie=p.div`
  color: ${({theme:e})=>e.font.color.primary};
`,je=({field:e})=>{const{getIcon:c}=N(),h=j(),o=c(e==null?void 0:e.icon);return b(Se,{children:[o&&t(o,{size:h.icon.size.md}),t(Ie,{children:e.label})]})},Ee=p.div`
  background-color: ${({theme:e})=>e.background.secondary};
  border-radius: ${({theme:e})=>e.border.radius.md};
  display: flex;
  flex-direction: column;
  width: 220px;
  padding: ${({theme:e})=>e.spacing(2)};
  gap: ${({theme:e})=>e.spacing(2)};
  border: 1px solid ${({theme:e})=>e.border.color.medium};
  box-shadow: ${({theme:e})=>e.boxShadow.light};
`,Me=p.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
`,De=p.div`
  border: 0;
  border-radius: 4px 4px 0 0;
  display: flex;
  font-weight: ${({theme:e})=>e.font.weight.medium};
  gap: ${({theme:e})=>e.spacing(1)};
  position: relative;
  text-align: center;
`,Pe=p.div`
  border: 1px solid ${({theme:e})=>e.border.color.light};
  background-color: ${({theme:e})=>e.background.primary};
  border-radius: ${({theme:e})=>e.border.radius.sm};
  padding: ${({theme:e})=>e.spacing(2)} 0
    ${({theme:e})=>e.spacing(2)} 0;
  display: flex;
  flex-flow: column nowrap;
  gap: ${({theme:e})=>e.spacing(.5)};
  color: ${({theme:e})=>e.font.color.tertiary};
`,A=p.div`
  align-items: center;
  display: flex;
  height: 24px;
  gap: ${({theme:e})=>e.spacing(1)};
`,Ce=p.div`
  align-items: center;
  cursor: pointer;
  display: flex;
  height: 24px;
  padding: 0 ${({theme:e})=>e.spacing(2)};
  gap: ${({theme:e})=>e.spacing(2)};

  &:hover {
    background-color: ${({theme:e})=>e.background.tertiary};
  }
`,Re=p.div``,Fe=p.div`
  color: ${({theme:e})=>e.font.color.tertiary};
`,Ne=p(X)`
  align-items: center;
  display: flex;
  gap: ${({theme:e})=>e.spacing(1)};
  text-decoration: none;
  color: ${({theme:e})=>e.font.color.primary};

  &:hover {
    color: ${({theme:e})=>e.font.color.secondary};
  }
`,Te=({data:e})=>{const c=j(),{getIcon:h}=N(),[o,r]=k.useState(!1),{totalCount:i}=K({objectNameSingular:e.nameSingular}),s=e.fields.filter(n=>!n.isSystem&&n.isActive),u=s.filter(n=>n.type!==F.RELATION).length,y=h(e.icon);return b(Ee,{children:[b(Me,{children:[b(De,{onMouseEnter:()=>{},onMouseLeave:()=>{},children:[b(Ne,{to:Y(W.Objects,{objectNamePlural:e.namePlural}),children:[y&&t(y,{size:c.icon.size.md}),Q(e.namePlural)]}),b(Fe,{children:[" · ",i]})]}),t(be,{objectTypeLabel:me(e)})]}),b(Pe,{children:[s.filter(n=>n.type===F.RELATION).map(n=>t(A,{children:t(ve,{field:n})},n.id)),u>0&&b(B,{children:[b(Ce,{onClick:()=>r(!o),children:[o?t(q,{size:c.icon.size.md}):t(Z,{size:c.icon.size.md}),b(Re,{children:[u," fields"]})]}),o&&s.filter(n=>n.type!==F.RELATION).map(n=>t(A,{children:t(je,{field:n})},n.id))]})]})]})},_e=()=>{const e=j();return t("svg",{style:{position:"absolute",top:0,left:0},children:t("defs",{children:t("marker",{id:"marker",viewBox:"0 0 6 6",markerHeight:"6",markerWidth:"6",refX:"3",refY:"3",fill:"none",children:t("circle",{cx:"3",cy:"3",r:"3",fill:e.color.gray})})})})},M=(e,c,h,o,r)=>{if(r==="source")return c>o+h||c+e>o?"left":"right";if(r==="target")return c>o+h?"right":"left"},ze={object:Te},He=p.div`
  height: 100%;
  .react-flow__handle {
    border: 0 !important;
    background: transparent !important;
    width: 6px;
    height: 6px;
    min-height: 6px;
    min-width: 6px;
    pointer-events: none;
  }
  .left-handle {
    left: 0;
    top: 50%;
    transform: translateX(-50%) translateY(-50%);
  }
  .right-handle {
    right: 0;
    top: 50%;
    transform: translateX(50%) translateY(-50%);
  }
  .react-flow__node {
    z-index: -1 !important;
  }
`,Le=p.div`
  position: absolute;
  top: ${({theme:e})=>e.spacing(3)};
  left: ${({theme:e})=>e.spacing(3)};
  z-index: 5;
`,Ae=()=>{const{fitView:e,zoomIn:c,zoomOut:h}=ee(),[o,r]=te([]),[i,s]=ne([]),[u,y]=k.useState(!0),n=k.useCallback(d=>r(g=>oe(d,g)),[r]),l=k.useCallback(d=>s(g=>ie(d,g)),[s]),a=k.useCallback(d=>{d.forEach(g=>{var T;const w=o.find(f=>f.id===g.id);if(!w)return;const G=ae(w,o,i),O="positionAbsolute"in g?(T=g.positionAbsolute)==null?void 0:T.x:w.position.x||0;G.forEach(f=>{const x=i.find($=>$.target===w.id&&$.source===f.id);v(O)&&s($=>$.map(m=>{var S,I;if(v(x)&&m.id===x.id){const D=M(f.width,f.position.x,w.width,O,"source"),P=M(f.width,f.position.x,w.width,O,"target"),C=`${(S=x.data)==null?void 0:S.sourceField}-${D}`,R=`${(I=x.data)==null?void 0:I.targetField}-${P}`;m.sourceHandle=C,m.targetHandle=R,m.markerEnd="marker",m.markerStart="marker"}return m}))}),re(w,o,i).forEach(f=>{const x=i.find($=>$.target===f.id&&$.source===w.id);v(O)&&s($=>$.map(m=>{var S,I;if(v(x)&&m.id===x.id){const D=M(w.width,O,f.width,f.position.x,"source"),P=M(w.width,O,f.width,f.position.x,"target"),C=`${(S=x.data)==null?void 0:S.sourceField}-${D}`,R=`${(I=x.data)==null?void 0:I.targetField}-${P}`;m.sourceHandle=C,m.targetHandle=R,m.markerEnd="marker",m.markerStart="marker"}return m}))})}),n(d)},[n,s,o,i]);return b(He,{children:[t(Le,{children:t(se,{Icon:ce,to:"/settings/objects"})}),t($e,{setEdges:s,setNodes:r}),t(_e,{}),b(le,{fitView:!0,nodes:o,edges:i,onEdgesChange:l,nodeTypes:ze,onNodesChange:a,nodesDraggable:u,elementsSelectable:u,proOptions:{hideAttribution:!0},children:[t(de,{}),t(ue,{className:"react-flow__panel react-flow__controls bottom left",size:"small",iconButtons:[{Icon:ge,onClick:()=>c()},{Icon:pe,onClick:()=>h()},{Icon:ye,onClick:()=>e()},{Icon:u?we:he,onClick:()=>y(!u)}]})]})]})},Je=()=>t(xe,{links:[{children:"Workspace",href:Y(W.Workspace)},{children:"Objects",href:"/settings/objects"},{children:"Overview"}],children:t(fe,{children:t(Ae,{})})});export{Je as SettingsObjectOverview};
