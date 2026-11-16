'use strict';
(() => {
  // Parent is translate(position) rotate(angle) scale(mirror,1). Cancel only
  // the glyph orientation about its anchor; leave that anchor attached to its pin.
  function inverse(pose,x=0,y=0){return `translate(${x} ${y}) scale(${pose.mirror?-1:1} 1) rotate(${-pose.rotation}) translate(${-x} ${-y})`;}
  function upright(markup,pose){
    const text=markup.replace(/<text\b([^>]*)>([\s\S]*?)<\/text>/g,(whole,attributes)=>{
      const coordinate=name=>Number(new RegExp('\\b'+name+'="([^"]+)"').exec(attributes)?.[1]||0);
      return `<g transform="${inverse(pose,coordinate('x'),coordinate('y'))}">${whole}</g>`;
    });
    return text.replaceAll('<g data-upright-icon>',`<g data-upright-icon transform="${inverse(pose)}">`);
  }
  globalThis.CircuitSymbolOrientation={inverse,upright};
})();
