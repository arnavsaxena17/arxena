import{n as i,h as g,r as s,j as t,T as p,s as f,t as h,S as d,a as u,G as x}from"./index-BzerUb1B.js";import{S as y}from"./SettingsPageContainer-VijhEKua.js";import{S}from"./SubMenuTopBarContainer-DvhK9_Ug.js";import{unified as $}from"./index-CHRTqw_J.js";import w from"./index-7hfrFxRp.js";import _ from"./index-HzGzMrLM.js";import R from"./index-Dodp15H5.js";import{v as j}from"./index-CEaDWk2K.js";import"./index-C4pE34cN.js";import"./index-Ch_qCilz.js";import"./index-C0BGJspr.js";import"./index-CrEIjHUD.js";import"./index-D7TIu75F.js";import"./index-C_aolqmU.js";import"./index-D1ONPEmv.js";import"./index-DiTsIWAy.js";const k=i.div`
  img {
    margin: ${({theme:e})=>e.spacing(6)} 0px 0px;
    max-width: 100%;
  }

  p img {
    margin: 0px;
  }

  h3 {
    color: ${({theme:e})=>e.font.color.primary};
    margin: ${({theme:e})=>e.spacing(6)} 0px 0px;
  }
  code {
    background: ${({theme:e})=>e.background.tertiary};
    padding: 4px;
    border-radius: 4px;
  }
  p {
    color: ${({theme:e})=>e.font.color.secondary};
    font-family: Inter, sans-serif;
    font-size: ${({theme:e})=>e.font.size.md};
    line-height: 19.5px;
    font-weight: ${({theme:e})=>e.font.weight.regular};
    margin: ${({theme:e})=>e.spacing(6)} 0px 0px;
    text-align: justify;
  }

  li {
    color: ${({theme:e})=>e.font.color.secondary};
  }

  li strong {
    color: ${({theme:e})=>e.font.color.primary};
  }
`,v=i.h2`
  color: ${({theme:e})=>e.font.color.primary};
  font-weight: ${({theme:e})=>e.font.weight.medium};
  line-height: 18px;
  font-size: ${({theme:e})=>e.font.size.md};
  margin: 0;
  margin-top: ${({theme:e})=>e.spacing(10)};

  &:first-of-type {
    margin-top: 0;
  }
`,z=i.span`
  font-weight: ${({theme:e})=>e.font.weight.regular};
  font-size: 12px;
  line-height: 18px;
  color: ${({theme:e})=>e.font.color.tertiary};
`,q=()=>{const{i18n:e,_:P}=g(),[m,c]=s.useState([]);return s.useEffect(()=>{fetch("https://twenty.com/api/releases").then(async r=>{const n=await r.json();for(const a of n)a.html=String(await $().use(w).use(_).use(R).use(()=>l=>{j(l,o=>{(o.tagName==="h1"||o.tagName==="h2")&&(o.tagName="h3")})}).process(a.content));c(n)})},[]),t(S,{title:e._({id:"5icoS1"}),links:[{children:t(p,{id:"pmUArF"}),href:f(h.Workspace)},{children:t(p,{id:"5icoS1"})}],children:t(y,{children:t(d,{contextProviderName:"releases",componentInstanceId:"scroll-wrapper-releases",children:t(k,{children:m.map(r=>u(x.Fragment,{children:[t(v,{children:r.release}),t(z,{children:r.date}),t("div",{dangerouslySetInnerHTML:{__html:r.html}})]},r.slug))})})})})};export{q as Releases};
