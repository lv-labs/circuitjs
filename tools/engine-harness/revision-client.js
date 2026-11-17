'use strict';
// Browser transport default retained for the prototype; no UI behavior here.
(() => {
  const core=typeof module==='object'&&module.exports?require('../../packages/circuit-core/index.js'):globalThis.CircuitCore;
  globalThis.createRevisionWorker=(options={})=>core.browserTransport.create({url:'revision-worker.js',...options});
})();
