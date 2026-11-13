package com.lushprojects.circuitjs1.rebind;

import com.google.gwt.core.ext.LinkerContext;
import com.google.gwt.core.ext.TreeLogger;
import com.google.gwt.core.ext.UnableToCompleteException;
import com.google.gwt.core.ext.linker.AbstractLinker;
import com.google.gwt.core.ext.linker.ArtifactSet;
import com.google.gwt.core.ext.linker.CompilationResult;
import com.google.gwt.core.ext.linker.LinkerOrder;

/** Emit one fixed-permutation engine directly for importScripts, without DOM bootstrap. */
@LinkerOrder(LinkerOrder.Order.PRIMARY)
public class EngineWorkerLinker extends AbstractLinker {
    public String getDescription() { return "CircuitJS dedicated worker"; }

    public ArtifactSet link(TreeLogger logger, LinkerContext context, ArtifactSet artifacts)
            throws UnableToCompleteException {
        if (artifacts.find(CompilationResult.class).size() != 1) {
            logger.log(TreeLogger.ERROR, "Worker requires exactly one permutation");
            throw new UnableToCompleteException();
        }
        CompilationResult result = artifacts.find(CompilationResult.class).iterator().next();
        if (result.getJavaScript().length != 1) {
            logger.log(TreeLogger.ERROR, "Worker does not support deferred fragments");
            throw new UnableToCompleteException();
        }
        String prefix = "(function(){\nvar $wnd=self,$doc=undefined,$gwt={},$stats=null,$sessionId=null;\n"
            + "var $moduleName='" + context.getModuleName() + "',$moduleBase=new URL('.',self.location.href).href;\n"
            + "var $gwt_version='2.8.2',$strongName='" + result.getStrongName() + "';\n";
        String suffix = "\ngwtOnLoad(null,$moduleName,$moduleBase,0);\n})();\n";
        ArtifactSet output = new ArtifactSet(artifacts);
        output.add(emitString(logger, prefix + result.getJavaScript()[0] + suffix, "engine-worker.js"));
        return output;
    }
}
