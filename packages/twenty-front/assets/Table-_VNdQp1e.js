import{n as o,aO as s,aP as l,j as c,aE as u}from"./index-BzerUb1B.js";const p=o.div`
  align-items: center;
  color: ${({color:a,theme:r})=>a||r.font.color.secondary};
  display: flex;
  height: ${({theme:a})=>a.spacing(8)};
  justify-content: ${({align:a})=>a==="right"?"flex-end":a==="center"?"center":"flex-start"};
  padding: 0 ${({theme:a})=>a.spacing(2)};
  text-align: ${({align:a})=>a??"left"};
`,g=o("div",{shouldForwardProp:a=>!["isSelected"].includes(a)&&s(a)})`
  background-color: ${({isSelected:a,theme:r})=>a?r.accent.quaternary:"transparent"};
  border-radius: ${({theme:a})=>a.border.radius.sm};
  display: grid;
  grid-auto-columns: ${({gridAutoColumns:a})=>a??"1fr"};

  @media (max-width: ${l}px) {
    grid-auto-columns: ${({mobileGridAutoColumns:a,gridAutoColumns:r})=>a??r??"1fr"};
  }

  grid-auto-flow: column;
  transition: background-color
    ${({theme:a})=>a.animation.duration.normal}s;
  width: 100%;
  text-decoration: none;

  &:hover {
    background-color: ${({onClick:a,to:r,theme:t})=>a||r?t.background.transparent.light:"transparent"};
    cursor: ${({onClick:a,to:r})=>a||r?"pointer":"default"};
  }
`,f=({isSelected:a,onClick:r,to:t,className:e,children:n,gridAutoColumns:d,mobileGridAutoColumns:i})=>c(g,{isSelected:a,onClick:r,gridAutoColumns:d,className:e,mobileGridAutoColumns:i,to:t,as:t?u:"div",children:n}),m=o.div``;export{m as S,f as T,p as a};
