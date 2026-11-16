// Load the generated worker bundle in an isolated Node VM. No window/document shims.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
export function createEngine(site=path.resolve('build/engine-site')) {
  const context=vm.createContext({console,URL,performance,setTimeout,clearTimeout});
  context.self=context;
  context.location={href:pathToFileURL(path.join(site,'worker.js')).href};
  vm.runInContext(readFileSync(path.join(site,'circuitjsworker/engine-worker.js'),'utf8'),context,{timeout:10000});
  if(!context.CircuitEngine)throw new Error('Compiled worker did not publish CircuitEngine');
  return context.CircuitEngine;
}
