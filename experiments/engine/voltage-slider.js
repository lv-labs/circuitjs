'use strict';
// Coalesce pointer input while a worker update is pending; commit only once per gesture.
(() => {
  function create({preview,commit,onError=()=>{},schedule=requestAnimationFrame,cancel=cancelAnimationFrame}){
    let draft=null,queued=null,pending=false,dirty=false;
    function clear(){if(queued!==null)cancel(queued);queued=null;draft=null;dirty=false;}
    function flushSoon(){if(queued!==null||pending||!dirty)return;queued=schedule(()=>{
      queued=null;if(!dirty||!draft)return;
      const value={...draft};dirty=false;pending=true;
      let result;try{result=preview(value);}catch(error){onError(error);}
      Promise.resolve(result).catch(onError).finally(()=>{pending=false;flushSoon();});
    });}
    return {
      get draft(){return draft&&{...draft};},
      input(id,voltage){draft={id,voltage};dirty=true;flushSoon();},
      finish(){if(!draft)return;const value={...draft};clear();
        // Returning to the original saved value is a history no-op, but must still
        // restore the physical source after earlier previews in this gesture.
        if(!commit(value))Promise.resolve(preview(value)).catch(onError);
      },
      cancel(){if(!draft)return;clear();Promise.resolve(preview(null)).catch(onError);},
      clear
    };
  }
  globalThis.CircuitVoltageSlider={create};
})();
