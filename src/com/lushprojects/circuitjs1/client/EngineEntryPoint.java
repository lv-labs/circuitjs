package com.lushprojects.circuitjs1.client;

import java.util.HashMap;
import java.util.Random;
import java.util.Vector;

import com.google.gwt.core.client.EntryPoint;
import com.google.gwt.core.client.JavaScriptObject;
import com.lushprojects.circuitjs1.client.util.Locale;

/** Phase 0 browser engine spike. Single session; no editor or rendering startup. */
public class EngineEntryPoint implements EntryPoint {
    private CirSim app;
    private String loadedText;
    private double loadedTimeStep;

    public void onModuleLoad() {
        Locale.localizationMap = new HashMap<String, String>();
        app = new CirSim();
        app.random = new Random(0);
        app.elmList = new Vector<CircuitElm>();
        CircuitElm.initSimulationClass(app, app.sim);
        publish();
    }

    // Deliberately restricted text format; do not silently ignore unsupported models.
    void load(String text, double timeStep) {
        if (text == null || !finite(timeStep) || timeStep <= 0)
            throw new IllegalArgumentException("Circuit text and a positive finite timestep are required");
        Vector<CircuitElm> elements = new Vector<CircuitElm>();
        String[] lines = text.split("\\r?\\n");
        for (int line = 0; line < lines.length; line++) {
            String value = lines[line].trim();
            if (value.length() == 0)
                continue;
            try {
                String[] fields = value.split("\\s+");
                if (fields.length < 6)
                    throw new IllegalArgumentException("Expected type, endpoints, and flags");
                String type = fields[0];
                int x1 = Integer.parseInt(fields[1]), y1 = Integer.parseInt(fields[2]);
                int x2 = Integer.parseInt(fields[3]), y2 = Integer.parseInt(fields[4]);
                int flags = Integer.parseInt(fields[5]);
                if (x1 == x2 && y1 == y2)
                    throw new IllegalArgumentException("Zero-length elements are unsupported");
                int expected = type.equals("r") ? 7 : type.equals("c") ? 9 :
                    type.equals("l") ? 10 : type.equals("s") ? 8 :
                    type.equals("v") ? 12 : type.equals("w") || type.equals("g") || type.equals("d") ? 6 : -1;
                if (fields.length != expected)
                    throw new IllegalArgumentException("Unsupported type or field count: " + type);
                if (flags != 0 && !((type.equals("c") || type.equals("l")) && flags == 2))
                    throw new IllegalArgumentException("Unsupported flags");
                for (int i = 6; i < fields.length; i++)
                    if (!(type.equals("s") && i == 7) && !finite(Double.parseDouble(fields[i])))
                        throw new IllegalArgumentException("Non-finite parameter");
                if ((type.equals("r") || type.equals("c") || type.equals("l")) && Double.parseDouble(fields[6]) <= 0)
                    throw new IllegalArgumentException("Resistance/capacitance must be positive");
                if (type.equals("v") && !(fields[6].equals("0") || fields[6].equals("1")))
                    throw new IllegalArgumentException("Only DC and sine voltage sources are supported");
                if (type.equals("v") && Double.parseDouble(fields[7]) < 0)
                    throw new IllegalArgumentException("Frequency must be nonnegative");
                if (type.equals("l") && Double.parseDouble(fields[9]) != 0)
                    throw new IllegalArgumentException("Saturating inductors are not supported yet");
                if (type.equals("s") && (!(fields[6].equals("0") || fields[6].equals("1")) || !fields[7].equals("false")))
                    throw new IllegalArgumentException("Switch requires position 0/1 and momentary=false");
                String parameters = "";
                for (int i = 6; i < fields.length; i++)
                    parameters += fields[i] + " ";
                StringTokenizer tokens = new StringTokenizer(parameters);
                CircuitElm elm;
                if (type.equals("r")) elm = new ResistorElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("c")) elm = new CapacitorElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("v")) elm = new VoltageElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("l")) elm = new InductorElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("d")) elm = new DiodeElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("s")) elm = new SwitchElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("w")) elm = new WireElm(x1, y1, x2, y2, flags, tokens);
                else elm = new GroundElm(x1, y1, x2, y2, flags, tokens);
                elm.setPoints();
                elements.add(elm);
            } catch (Exception e) {
                throw new IllegalArgumentException("Line " + (line + 1) + ": " + e.getMessage());
            }
        }
        if (elements.isEmpty())
            throw new IllegalArgumentException("Circuit must contain elements");
        app.elmList = elements;
        app.sim.resetTime();
        app.sim.matrices = null;
        app.sim.maxTimeStep = app.sim.minTimeStep = app.sim.timeStep = timeStep;
        app.sim.adjustTimeStep = false;
        app.sim.lastIterTime = 0;
        app.sim.analyzeCircuit();
        app.sim.preStampAndStampCircuit();
        loadedText = text;
        loadedTimeStep = timeStep;
        checkStopped();
    }

    void reset() {
        if (loadedText == null)
            throw new IllegalStateException("Load a circuit first");
        load(loadedText, loadedTimeStep);
    }

    void setSwitch(int id, boolean closed) {
        if (id < 0 || id >= app.elmList.size() || !(app.elmList.get(id) instanceof SwitchElm))
            throw new IllegalArgumentException("Expected a switch element ID");
        checkStopped();
        SwitchElm elm = (SwitchElm) app.elmList.get(id);
        int position = closed ? 0 : 1;
        if (elm.position == position)
            return;
        elm.position = position;
        app.sim.analyzeCircuit();
        app.sim.preStampAndStampCircuit();
        checkStopped();
    }

    void step(int count) {
        if (loadedText == null)
            throw new IllegalStateException("Load a circuit first");
        checkStopped();
        app.sim.stepCircuit(count);
        checkStopped();
    }

    private void checkStopped() {
        if (app.stopMessage != null)
            throw new IllegalStateException(app.stopMessage);
    }

    private static boolean finite(double value) {
        return !Double.isNaN(value) && !Double.isInfinite(value);
    }

    JavaScriptObject snapshot() {
        JavaScriptObject result = newSnapshot(app.sim.t, app.sim.timeStep, app.stopMessage,
            app.ui == null && app.mouse == null && app.scopeManager == null && app.jsInterface == null);
        for (int i = 0; i < app.elmList.size(); i++) {
            CircuitElm elm = app.elmList.get(i);
            appendElement(result, i, "" + (char) elm.getDumpType(), elm.getCurrent(), elm.volts);
        }
        return result;
    }

    private native JavaScriptObject newSnapshot(double time, double timeStep, String error, boolean editorFree) /*-{
        return {time: time, timeStep: timeStep, error: error, editorFree: editorFree, elements: []};
    }-*/;

    private native void appendElement(JavaScriptObject result, int id, String type, double current, double[] volts) /*-{
        result.elements.push({id: id, type: type, current: current, voltages: Array.prototype.slice.call(volts)});
    }-*/;

    private native void publish() /*-{
        var that = this;
        $wnd.CircuitEngine = {
            load: $entry(function(text, dt) {
                that.@com.lushprojects.circuitjs1.client.EngineEntryPoint::load(Ljava/lang/String;D)(text, dt);
                return that.@com.lushprojects.circuitjs1.client.EngineEntryPoint::snapshot()();
            }),
            step: $entry(function(count) {
                if (!Number.isInteger(count) || count < 1 || count > 10000)
                    throw new Error("Step count must be an integer between 1 and 10000");
                that.@com.lushprojects.circuitjs1.client.EngineEntryPoint::step(I)(count);
                return that.@com.lushprojects.circuitjs1.client.EngineEntryPoint::snapshot()();
            }),
            reset: $entry(function() {
                that.@com.lushprojects.circuitjs1.client.EngineEntryPoint::reset()();
                return that.@com.lushprojects.circuitjs1.client.EngineEntryPoint::snapshot()();
            }),
            setSwitch: $entry(function(id, closed) {
                if (!Number.isInteger(id) || typeof closed !== 'boolean')
                    throw new Error("Switch ID must be an integer and closed must be boolean");
                that.@com.lushprojects.circuitjs1.client.EngineEntryPoint::setSwitch(IZ)(id, closed);
                return that.@com.lushprojects.circuitjs1.client.EngineEntryPoint::snapshot()();
            }),
            snapshot: $entry(function() {
                return that.@com.lushprojects.circuitjs1.client.EngineEntryPoint::snapshot()();
            })
        };
        if ($wnd.oncircuitengineready) $wnd.oncircuitengineready($wnd.CircuitEngine);
    }-*/;
}
