import assert from 'node:assert/strict';
import {createTypeScriptLoader, React, renderToStaticMarkup} from './typescript_module.mjs';
const {Upright,UprightText}=createTypeScriptLoader()(new URL('../packages/circuit-symbols/svg.tsx',import.meta.url));
function transform(text,point){
 const ops=[...text.matchAll(/(translate|rotate|scale)\(([^)]+)\)/g)];
 return ops.reverse().reduce(([x,y],[,op,args])=>{const n=args.split(/[ ,]+/).map(Number);if(op==='translate')return [x+n[0],y+(n[1]||0)];if(op==='scale')return [x*n[0],y*(n[1]??n[0])];const a=n[0]*Math.PI/180;return [x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];},point);
}
const near=(a,b)=>a.forEach((n,i)=>assert.ok(Math.abs(n-b[i])<1e-10,`${a} != ${b}`));
for(const rotation of [0,90,180,270])for(const mirror of [false,true])for(const [x,y] of [[0,0],[0,-9],[-20,36],[12,5]]){
 const pose={rotation,mirror},parent=`translate(160 240) rotate(${rotation}) scale(${mirror?-1:1} 1)`;
 const label=renderToStaticMarkup(React.createElement(UprightText,{pose,x,y,children:'A & B'}));
 const inverse=/transform="([^"]+)"/.exec(label)?.[1]||'';
 const combined=parent+' '+inverse,anchor=transform(parent,[x,y]);
 near(transform(combined,[x,y]),anchor);near(transform(combined,[x+1,y]),[anchor[0]+1,anchor[1]]);near(transform(combined,[x,y+1]),[anchor[0],anchor[1]+1]);
 assert.ok(label.includes('A &amp; B'));
 const icon=renderToStaticMarkup(React.createElement(Upright,{pose},React.createElement('path',{d:'M-12 0H12'})));
 assert.ok(icon.includes('d="M-12 0H12"'));
 assert.equal(/transform=/.test(icon),!!rotation||mirror);
}
console.log('React symbol orientation passed: all quarter-turns/mirrors preserve label anchors, upright glyph axes and source icon geometry.');
