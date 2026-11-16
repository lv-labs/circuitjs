import assert from 'node:assert/strict';
import '../experiments/engine/symbol-orientation.js';
const O=CircuitSymbolOrientation;
function transform(text,point){
 const ops=[...text.matchAll(/(translate|rotate|scale)\(([^)]+)\)/g)];
 return ops.reverse().reduce(([x,y],[,op,args])=>{const n=args.split(/[ ,]+/).map(Number);if(op==='translate')return [x+n[0],y+(n[1]||0)];if(op==='scale')return [x*n[0],y*(n[1]??n[0])];const a=n[0]*Math.PI/180;return [x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];},point);
}
const near=(a,b)=>a.forEach((n,i)=>assert.ok(Math.abs(n-b[i])<1e-10,`${a} != ${b}`));
for(const rotation of [0,90,180,270])for(const mirror of [false,true])for(const [x,y] of [[0,0],[0,-9],[-20,36],[12,5]]){
 const pose={rotation,mirror},parent=`translate(160 240) rotate(${rotation}) scale(${mirror?-1:1} 1)`,combined=parent+' '+O.inverse(pose,x,y),anchor=transform(parent,[x,y]);
 near(transform(combined,[x,y]),anchor);near(transform(combined,[x+1,y]),[anchor[0]+1,anchor[1]]);near(transform(combined,[x,y+1]),[anchor[0],anchor[1]+1]);
 const body='<path d="M-48 0H48"/>',label=`<text x="${x}" y="${y}" text-anchor="end">A &amp; B</text>`,svg=O.upright(body+label,pose);
 assert.ok(svg.startsWith(body));assert.ok(svg.includes(label));assert.ok(svg.includes(`transform="${O.inverse(pose,x,y)}"`));
 const icon='<g data-upright-icon><path d="M-12 0H12"/></g>';assert.equal(O.upright(icon,pose),`<g data-upright-icon transform="${O.inverse(pose)}"><path d="M-12 0H12"/></g>`);
}
console.log('Symbol orientation passed: all quarter-turns/mirrors preserve label anchors, upright glyph axes, source icon geometry and rotating body paths.');
