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
        app.gridSize = 16;
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
                boolean voltage = type.equals("v") || type.equals("R");
                boolean gate = type.equals("150") || type.equals("151") || type.equals("152") || type.equals("153") || type.equals("154");
                boolean fet = type.equals("f") || type.equals("j");
                int expected = type.equals("T") ? 12 : type.equals("S") ? 10 : type.equals("429") ? 9 : type.equals("162") ? 11 : type.equals("z") ? 8 : gate ? 9 : type.equals("t") ? 10 : fet || type.equals("I") ? 8 : type.equals("r") ? 7 : type.equals("c") ? 9 :
                    type.equals("174") ? 9 : type.equals("i") ? 8 : type.equals("l") ? 10 : type.equals("s") ? 8 :
                    voltage || type.equals("a") ? 12 : type.equals("w") || type.equals("g") || type.equals("d") ? 6 : -1;
                if (fields.length != expected)
                    throw new IllegalArgumentException("Unsupported type or field count: " + type);
                if (flags != 0 && !((type.equals("S") || type.equals("162") || type.equals("z")) && flags == 1) && !(type.equals("T") && flags == 2) && !(fet && flags == 1) && !((type.equals("c") || type.equals("l")) && flags == 2) && !(type.equals("a") && flags == 8) && !(voltage && flags == 4 && fields[6].equals("5")))
                    throw new IllegalArgumentException("Unsupported flags");
                for (int i = 6; i < fields.length; i++)
                    if (!((type.equals("s") || type.equals("S") || type.equals("429")) && i == 7) && !(type.equals("174") && i == 8) && !finite(Double.parseDouble(fields[i])))
                        throw new IllegalArgumentException("Non-finite parameter");
                if ((type.equals("r") || type.equals("c") || type.equals("l")) && Double.parseDouble(fields[6]) <= 0)
                    throw new IllegalArgumentException("Resistance/capacitance must be positive");
                if (type.equals("S") || type.equals("429")) {
                    int pos = Integer.parseInt(fields[6]);
                    if (pos < 0 || pos > (type.equals("S") ? 2 : 1) || !fields[7].equals("false") ||
                        y1 != y2 || x2-x1 != 64 || (type.equals("S") ? flags != 1 || !fields[8].equals("0") || !fields[9].equals("2") : !fields[8].equals("2")))
                        throw new IllegalArgumentException("Invalid multipole switch parameters or geometry");
                }
                if (type.equals("162") || type.equals("z")) {
                    if (flags != 1 || Double.parseDouble(fields[6]) <= 0 ||
                        (type.equals("z") ? Double.parseDouble(fields[7]) <= 0 :
                         !fields[7].equals("1") || !fields[8].equals("0") || !fields[9].equals("0") || Double.parseDouble(fields[10]) <= 0))
                        throw new IllegalArgumentException("Invalid LED/Zener parameters");
                }
                if (type.equals("T")) {
                    double l = Double.parseDouble(fields[6]), ratio = Double.parseDouble(fields[7]), k = Double.parseDouble(fields[10]);
                    double l2 = l*ratio*ratio, mutual = k*Math.sqrt(l*l2), determinant = l*l2-mutual*mutual;
                    if (l <= 0 || ratio <= 0 || k <= 0 || k >= 1 || !finite(determinant) || determinant <= 0 || !finite(1/determinant) ||
                        Double.parseDouble(fields[8]) != 0 || Double.parseDouble(fields[9]) != 0 || Double.parseDouble(fields[11]) != 0 ||
                        x2-x1 != 64 || y1 != 32 || y2 != 64)
                        throw new IllegalArgumentException("Invalid linear transformer parameters or geometry");
                }
                if ((gate || type.equals("t") || fet) && (y1 != y2 || x2-x1 != 64))
                    throw new IllegalArgumentException("Model requires horizontal synthetic geometry");
                if (gate && (!fields[6].equals("2") || Double.parseDouble(fields[8]) <= 0))
                    throw new IllegalArgumentException("Gate requires two inputs and positive logic voltage");
                if (type.equals("I") && (Double.parseDouble(fields[6]) <= 0 || Double.parseDouble(fields[7]) <= 0))
                    throw new IllegalArgumentException("Invalid inverter parameters");
                if (fet && Double.parseDouble(fields[7]) <= 0)
                    throw new IllegalArgumentException("FET beta must be positive");
                if (type.equals("t") && (!(fields[6].equals("1") || fields[6].equals("-1")) || Double.parseDouble(fields[9]) <= 0))
                    throw new IllegalArgumentException("Invalid bipolar transistor parameters");
                if (type.equals("i") && Double.parseDouble(fields[7]) < 0)
                    throw new IllegalArgumentException("Current-source compliance must be nonnegative");
                if (type.equals("174") && (Double.parseDouble(fields[6]) <= 0 ||
                    Double.parseDouble(fields[7]) < 0 || Double.parseDouble(fields[7]) > 1 ||
                    x2-x1 != 64 || y1 != 32 || y2 != 0 || !fields[8].equals("Resistance")))
                    throw new IllegalArgumentException("Invalid potentiometer geometry or parameters");
                if (voltage && !(fields[6].equals("0") || fields[6].equals("1") || fields[6].equals("2") ||
                    fields[6].equals("3") || fields[6].equals("4") || fields[6].equals("5")))
                    throw new IllegalArgumentException("Unsupported voltage waveform");
                if (voltage && (Double.parseDouble(fields[11]) <= 0 || Double.parseDouble(fields[11]) >= 1 ||
                    (fields[6].equals("5") && flags != 4)))
                    throw new IllegalArgumentException("Expected duty cycle between 0 and 1; pulse requires duty flag");
                if (voltage && Double.parseDouble(fields[7]) < 0)
                    throw new IllegalArgumentException("Frequency must be nonnegative");
                if (type.equals("l") && Double.parseDouble(fields[9]) != 0)
                    throw new IllegalArgumentException("Saturating inductors are not supported yet");
                if (type.equals("s") && (!(fields[6].equals("0") || fields[6].equals("1")) || !fields[7].equals("false")))
                    throw new IllegalArgumentException("Switch requires position 0/1 and momentary=false");
                if (type.equals("a") && (flags != 8 || x1 == x2 || y1 != y2 ||
                    Double.parseDouble(fields[6]) <= Double.parseDouble(fields[7]) ||
                    !finite(Double.parseDouble(fields[6])-Double.parseDouble(fields[7])) ||
                    Double.parseDouble(fields[11]) <= 0))
                    throw new IllegalArgumentException("Op-amp requires horizontal geometry, gain flag, ordered limits and positive gain");
                String parameters = "";
                for (int i = 6; i < fields.length; i++)
                    parameters += fields[i] + " ";
                StringTokenizer tokens = new StringTokenizer(parameters);
                CircuitElm elm;
                if (type.equals("r")) elm = new ResistorElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("c")) elm = new CapacitorElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("v")) elm = new VoltageElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("R")) elm = new RailElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("i")) {
                    CurrentElm source = new CurrentElm(x1, y1, x2, y2, flags, tokens);
                    // The legacy loader treats zero as a missing value; documents permit zero.
                    source.currentValue = Double.parseDouble(fields[6]);
                    elm = source;
                }
                else if (type.equals("T")) elm = new TransformerElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("S")) elm = new Switch2Elm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("429")) elm = new DPDTSwitchElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("162")) elm = new LEDElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("z")) elm = new ZenerElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("t")) elm = new TransistorElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("f")) elm = new MosfetElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("j")) elm = new JfetElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("150")) elm = new AndGateElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("151")) elm = new NandGateElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("152")) elm = new OrGateElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("153")) elm = new NorGateElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("154")) elm = new XorGateElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("I")) elm = new InverterElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("174")) elm = new PotElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("l")) elm = new InductorElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("d")) elm = new DiodeElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("s")) elm = new SwitchElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("a")) elm = new OpAmpElm(x1, y1, x2, y2, flags, tokens);
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
