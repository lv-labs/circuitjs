import {createRequire} from 'node:module';
import {readFileSync, existsSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(new URL('../wires/package.json',import.meta.url));
const ts=require('typescript');
export const React=require('react');
export const {renderToStaticMarkup}=require('react-dom/server');
export function createTypeScriptLoader(){
 const modules=new Map();
 function load(file){
  if(modules.has(file.href))return modules.get(file.href);
  const output=ts.transpileModule(readFileSync(file,'utf8'),{fileName:file.pathname,compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exports={};modules.set(file.href,exports);
  vm.runInNewContext(output,{exports,require:name=>{
   if(!name.startsWith('.'))return require(name);
   const target=['','.ts','.tsx','.js'].map(ext=>new URL(name+ext,file)).find(url=>existsSync(url));
   if(!target)throw new Error(`Missing module ${name} from ${file.pathname}`);
   return load(target);
  }},{filename:file.pathname});
  return exports;
 }
 return load;
}
