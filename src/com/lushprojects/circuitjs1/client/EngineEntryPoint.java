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
        app.gridMask = ~(app.gridSize - 1);
        app.gridRound = app.gridSize / 2 - 1;
        app.random = new Random(0);
        app.elmList = new Vector<CircuitElm>();
        CircuitElm.initSimulationClass(app, app.sim);
        publish();
    }

    // Deliberately restricted text format; do not silently ignore unsupported models.
    private Vector<CircuitElm> parse(String text, double timeStep) {
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
                CircuitElm signal = EngineSourceSupport.construct(fields, x1, y1, x2, y2, flags, timeStep);
                if (signal != null) { signal.setPoints(); elements.add(signal); continue; }
                CircuitElm passiveModel = EnginePassiveSupport.construct(fields, x1, y1, x2, y2, flags, timeStep);
                if (passiveModel != null) { passiveModel.setPoints(); elements.add(passiveModel); continue; }
                CircuitElm semiconductor = EngineSemiconductorSupport.construct(fields, x1, y1, x2, y2, flags, timeStep);
                if (semiconductor != null) { semiconductor.setPoints(); elements.add(semiconductor); continue; }
                CircuitElm output = EngineOutputSupport.construct(fields,timeStep);
                if (output != null) { output.setPoints(); elements.add(output); continue; }
                boolean voltage = type.equals("v") || type.equals("R");
                boolean analog = type.equals("159") || type.equals("160");
                boolean capacitor = type.equals("c") || type.equals("209");
                boolean gate = type.equals("150") || type.equals("151") || type.equals("152") || type.equals("153") || type.equals("154") || type.equals("431");
                boolean fet = type.equals("f") || type.equals("j");
                // Display-only markers (O, M) and the ground-referenced logic source (L)
                // have optional trailing parameters in the legacy text format.
                boolean display = type.equals("O") || type.equals("L") || type.equals("M");
                boolean chip = type.equals("155") || type.equals("156") || type.equals("193");
                int expected = analog ? 9 : type.equals("209") ? 10 : type.equals("T") ? 12 : type.equals("S") ? 10 : type.equals("429") ? 9 : type.equals("162") ? 11 : type.equals("z") ? 8 : gate ? 9 : type.equals("t") ? 10 : fet || type.equals("I") ? 8 : type.equals("r") ? 7 : type.equals("c") ? 9 :
                    type.equals("174") ? 9 : type.equals("i") ? 8 : type.equals("l") ? 10 : type.equals("s") ? 8 :
                    voltage || type.equals("a") ? 12 : type.equals("w") || type.equals("g") || type.equals("d") ? 6 : -1;
                boolean passive = type.equals("169") || type.equals("406") || type.equals("171") || type.equals("416");
                boolean nextChip = type.equals("164") || type.equals("168") || type.equals("195") || type.equals("196");
                int extraVoltage = (flags & 8192) != 0 ? 1 : 0;
                boolean countOk = passive ? fields.length == (type.equals("169") ? 12 : type.equals("406") ? 13 : type.equals("171") ? 10 : 9) : nextChip ? fields.length == ((type.equals("164") ? 13 : type.equals("168") ? 11 : type.equals("195") ? 6 : 7) + extraVoltage) : chip ? fields.length == (((flags & 8192) != 0) ? 9 : 8) :
                    display ? (type.equals("L") ? (fields.length == 8 || fields.length == 10) :
                    (fields.length == 6 || fields.length == 7)) : fields.length == expected;
                if (!countOk)
                    throw new IllegalArgumentException("Unsupported type or field count: " + type);
                int chipFlags = flags & ~8192;
                boolean nextChipFlags = type.equals("164") ? chipFlags == 0 || chipFlags == 8 :
                    type.equals("168") ? chipFlags == 2 || chipFlags == 6 : type.equals("196") ? chipFlags == 2 : chipFlags == 0;
                if (nextChip && !nextChipFlags)
                    throw new IllegalArgumentException("Unsupported chip flags");
                if (flags != 0 && !(passive && (type.equals("169") || type.equals("406")) && flags == 2) && !(nextChip && nextChipFlags) && !(chip && (type.equals("156") ? (flags == 4 || flags == 8192 || flags == 8196) : flags == 8192)) && !(analog && flags >= 0 && flags <= 3) && !(display && flags >= 0 && flags <= (type.equals("M") ? 7 : 3)) && !((type.equals("S") || type.equals("162") || type.equals("z")) && flags == 1) && !(type.equals("T") && flags == 2) && !(fet && flags == 1) && !((capacitor || type.equals("l")) && flags == 2) && !(type.equals("a") && flags == 8) && !(voltage && flags == 4 && fields[6].equals("5")))
                    throw new IllegalArgumentException("Unsupported flags");
                for (int i = 6; i < fields.length; i++)
                    if (!(type.equals("406") && i == 8) && !(type.equals("416") && i == 7) && !(type.equals("164") && i == fields.length - 2) && !((type.equals("s") || type.equals("S") || type.equals("429")) && i == 7) && !(type.equals("L") && i == 7) && !(type.equals("174") && i == 8) && !finite(Double.parseDouble(fields[i])))
                        throw new IllegalArgumentException("Non-finite parameter");
                if ((type.equals("r") || capacitor || type.equals("l")) && Double.parseDouble(fields[6]) <= 0)
                    throw new IllegalArgumentException("Resistance/capacitance must be positive");
                if (type.equals("209") && Double.parseDouble(fields[9]) < 0)
                    throw new IllegalArgumentException("Maximum reverse voltage must be nonnegative");
                if (passive) {
                    if (y1 != 32 || y2 != 32 || x2-x1 != 64)
                        throw new IllegalArgumentException("Invalid passive model geometry");
                    if (type.equals("416") && (Integer.parseInt(fields[6]) < 0 || Integer.parseInt(fields[6]) > 3 || !fields[7].equals("false") || !fields[8].equals("0")))
                        throw new IllegalArgumentException("Invalid MBB switch state or link");
                    if (type.equals("171")) {
                        double delay = Double.parseDouble(fields[6]), impedance = Double.parseDouble(fields[7]);
                        double steps = Math.floor(delay/timeStep);
                        if (delay <= 0 || impedance <= 0 || !finite(1/impedance) || steps < 1 || steps > 100000 || !fields[8].equals("32") || Double.parseDouble(fields[9]) != 0)
                            throw new IllegalArgumentException("Invalid transmission line delay, impedance, width or losses");
                    }
                    if (type.equals("169")) {
                        double l = Double.parseDouble(fields[6]), ratio = Double.parseDouble(fields[7]), k = Double.parseDouble(fields[11]);
                        double l2 = l*ratio*ratio/4, mutual = k*Math.sqrt(l*l2), det = l*(l2+k*l2)-2*mutual*mutual;
                        if (l <= 0 || ratio <= 0 || k <= 0 || k >= 1 || !finite(det) || det <= 0 || !finite(1/det) || !finite((l*l2-mutual*mutual)/(l2-k*l2)) ||
                            Double.parseDouble(fields[8]) != 0 || Double.parseDouble(fields[9]) != 0 || Double.parseDouble(fields[10]) != 0)
                            throw new IllegalArgumentException("Invalid tapped transformer parameters");
                    }
                    if (type.equals("406")) {
                        double l = Double.parseDouble(fields[6]), k = Double.parseDouble(fields[7]);
                        String[] turns = fields[8].split("[:,]", -1);
                        if (turns.length != 3 || fields[8].indexOf('+') >= 0 || fields[8].indexOf(',') < 0 || fields[8].indexOf(':') < fields[8].indexOf(',') || !fields[9].equals("3"))
                            throw new IllegalArgumentException("Custom transformer requires two primary and one secondary winding");
                        double product = 1;
                        double[] windings = new double[3]; int windingIndex = 0;
                        for (String turn : turns) { double n = Double.parseDouble(turn), winding = n*n*l; if (!finite(n) || n == 0 || !finite(winding) || winding <= 0) throw new IllegalArgumentException("Invalid winding turns"); windings[windingIndex++] = winding; product *= winding; }
                        for (double a : windings) for (double b : windings) if (!finite(a*b) || a*b <= 0) throw new IllegalArgumentException("Invalid mutual inductance range");
                        double det = product*(1-k)*(1-k)*(1+2*k);
                        if (l <= 0 || k <= 0 || k >= 1 || !finite(det) || det <= 0 || !finite(1/det) || Double.parseDouble(fields[10]) != 0 || Double.parseDouble(fields[11]) != 0 || Double.parseDouble(fields[12]) != 0)
                            throw new IllegalArgumentException("Invalid custom transformer parameters");
                    }
                }
                if (nextChip) {
                    boolean half = type.equals("195");
                    int base = half ? 6 : 7;
                    double hv = extraVoltage != 0 ? Double.parseDouble(fields[base]) : 5;
                    base += extraVoltage;
                    if ((!half && !fields[6].equals("4")) || hv <= 0 || !finite(hv) || y1 != y2 || x2-x1 != 64)
                        throw new IllegalArgumentException("Invalid chip size, geometry or logic voltage");
                    if (type.equals("164") || type.equals("168"))
                        for (int i = 0; i < 4; i++) {
                            double state = Double.parseDouble(fields[base+i]);
                            if (state != 0 && state != hv)
                                throw new IllegalArgumentException("Invalid stored chip output");
                        }
                    if (type.equals("164")) {
                        int modulus = Integer.parseInt(fields[fields.length-1]);
                        if (!(fields[fields.length-2].equals("true") || fields[fields.length-2].equals("false")) || modulus < 0 || modulus > 16)
                            throw new IllegalArgumentException("Invalid counter reset polarity or modulus");
                    }
                }
                if (chip) {
                    int base = ((flags & 8192) != 0) ? 7 : 6;
                    double hv = ((flags & 8192) != 0) ? Double.parseDouble(fields[6]) : 5;
                    double q = Double.parseDouble(fields[base]), qn = Double.parseDouble(fields[base + 1]);
                    if (!finite(hv) || hv <= 0 || y1 != y2 || x2 - x1 != 64 ||
                        !((q == 0 && qn == hv) || (q == hv && qn == 0)))
                        throw new IllegalArgumentException("Invalid flip-flop geometry, logic voltage or stored output state");
                }
                if (analog && (Double.parseDouble(fields[6]) <= 0 || Double.parseDouble(fields[7]) <= 0 ||
                    !finite(1/Double.parseDouble(fields[6])) || !finite(1/Double.parseDouble(fields[7])) || y1 != y2 || x2-x1 != 64))
                    throw new IllegalArgumentException("Invalid analog switch resistance or geometry");
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
                if (type.equals("s") && (!(fields[6].equals("0") || fields[6].equals("1")) || !(fields[7].equals("false") || fields[7].equals("true"))))
                    throw new IllegalArgumentException("Switch requires position 0/1 and boolean momentary");
                if (type.equals("O") && fields.length == 7) {
                    int scale = Integer.parseInt(fields[6]);
                    if (scale < 0 || scale > 3)
                        throw new IllegalArgumentException("Output scale must be auto, V, mV or uV");
                }
                if (type.equals("L")) {
                    boolean ternary = (flags & 1) != 0;
                    int pos = Integer.parseInt(fields[6]);
                    if (pos < 0 || pos > (ternary ? 2 : 1) || !fields[7].equals("false"))
                        throw new IllegalArgumentException("Logic input requires a valid state and momentary=false");
                }
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
                else if (type.equals("209")) elm = new PolarCapacitorElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("159")) elm = new AnalogSwitchElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("160")) elm = new AnalogSwitch2Elm(x1, y1, x2, y2, flags, tokens);
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
                else if (type.equals("431")) elm = new XnorGateElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("I")) elm = new InverterElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("174")) elm = new PotElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("l")) elm = new InductorElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("d")) elm = new DiodeElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("s")) elm = new SwitchElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("O")) elm = new OutputElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("M")) elm = new LogicOutputElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("L")) elm = new LogicInputElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("169")) elm = new TappedTransformerElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("406")) elm = new CustomTransformerElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("171")) elm = new TransLineElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("416")) elm = new MBBSwitchElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("164")) elm = new CounterElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("168")) elm = new LatchElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("195")) elm = new HalfAdderElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("196")) elm = new FullAdderElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("155")) elm = new DFlipFlopElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("156")) elm = new JKFlipFlopElm(x1, y1, x2, y2, flags, tokens);
                else if (type.equals("193")) elm = new TFlipFlopElm(x1, y1, x2, y2, flags, tokens);
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
        return elements;
    }

    void load(String text, double timeStep) {
        Vector<CircuitElm> elements=parse(text,timeStep);
        app.elmList = elements;
        app.sim.resetTime();
        app.sim.matrices = null;
        app.sim.maxTimeStep = app.sim.minTimeStep = app.sim.timeStep = timeStep;
        // Delay buffers must use this document's timestep, not the previously loaded circuit's.
        for (CircuitElm element : elements)
            if (element instanceof TransLineElm) element.reset();
        for (CircuitElm element : elements) initializeElement(element);
        app.sim.adjustTimeStep = false;
        app.sim.lastIterTime = 0;
        app.sim.analyzeCircuit();
        app.sim.preStampAndStampCircuit();
        loadedText = text;
        loadedTimeStep = timeStep;
        checkStopped();
    }

    void updateCircuit(String text,double timeStep,JavaScriptObject retained){
        if(loadedText==null)throw new IllegalArgumentException("Load a circuit first");
        Vector<CircuitElm> next=parse(text,timeStep),previous=app.elmList;
        int count=retainedCount(retained);
        boolean[] seenNew=new boolean[next.size()],seenOld=new boolean[previous.size()];
        for(int i=0;i<count;i++){
            int n=retainedIndex(retained,i,0),o=retainedIndex(retained,i,1);
            if(n<0||n>=next.size()||o<0||o>=previous.size()||seenNew[n]||seenOld[o]||next.get(n).getClass()!=previous.get(o).getClass())
                throw new IllegalArgumentException("Invalid retained element mapping");
            seenNew[n]=true;seenOld[o]=true;
        }
        // Reuse the actual instances: charge, flux, clock edges, captures, motor
        // momentum and nonlinear iteration state survive the same reanalysis as UI edits.
        for(int i=0;i<count;i++){
            int n=retainedIndex(retained,i,0),o=retainedIndex(retained,i,1);
            CircuitElm old=previous.get(o),fresh=next.get(n);
            if(retainedConfig(retained,i))EngineCircuitUpdate.configure(old,fresh);
            if(old instanceof LabeledNodeElm)((LabeledNodeElm)old).text=((LabeledNodeElm)fresh).text;
            old.x=fresh.x;old.y=fresh.y;old.x2=fresh.x2;old.y2=fresh.y2;
            old.setPoints();next.set(n,old);
        }
        for(int i=0;i<next.size();i++)if(!seenNew[i])initializeElement(next.get(i));
        app.elmList=next;
        app.sim.maxTimeStep=app.sim.minTimeStep=app.sim.timeStep=timeStep;
        if(timeStep!=loadedTimeStep)for(CircuitElm elm:next)if(elm instanceof TransLineElm)elm.reset();
        app.sim.analyzeCircuit();app.sim.preStampAndStampCircuit();
        loadedText=text;loadedTimeStep=timeStep;checkStopped();
    }
    private static void initializeElement(CircuitElm element) {
        EngineSourceSupport.initialize(element);
        EngineOutputSupport.initialize(element);
    }
    private static native int retainedCount(JavaScriptObject a) /*-{
        if(!Array.isArray(a)||a.length>100000)throw new Error('Invalid retained elements');
        for(var i=0;i<a.length;i++)if(!Array.isArray(a[i])||a[i].length!==3||!Number.isInteger(a[i][0])||!Number.isInteger(a[i][1])||typeof a[i][2]!=='boolean')throw new Error('Invalid retained entry');
        return a.length;
    }-*/;
    private static native int retainedIndex(JavaScriptObject a,int i,int j) /*-{return a[i][j];}-*/;
    private static native boolean retainedConfig(JavaScriptObject a,int i) /*-{return a[i][2];}-*/;

    void reset() {
        if (loadedText == null)
            throw new IllegalStateException("Load a circuit first");
        load(loadedText, loadedTimeStep);
    }

    void setSwitch(int id, boolean closed) {
        if (id < 0 || id >= app.elmList.size() || !(app.elmList.get(id) instanceof SwitchElm))
            throw new IllegalArgumentException("Expected a switch element ID");
        setContact(id, closed ? 0 : 1);
    }

    void setContact(int id, int position) {
        if (id < 0 || id >= app.elmList.size() || !(app.elmList.get(id) instanceof SwitchElm))
            throw new IllegalArgumentException("Expected switch/input element ID");
        SwitchElm elm = (SwitchElm) app.elmList.get(id);
        int max = elm instanceof MBBSwitchElm ? 3 : elm instanceof Switch2Elm ? 2 :
            elm instanceof LogicInputElm && ((LogicInputElm)elm).isTernary() ? 2 : 1;
        if(position < 0 || position > max)throw new IllegalArgumentException("Invalid contact position");
        checkStopped();
        if(elm.position == position)return;
        elm.position = position;
        app.sim.analyzeCircuit();
        app.sim.preStampAndStampCircuit();
        checkStopped();
    }

    void step(int count) {
        if (loadedText == null)
            throw new IllegalStateException("Load a circuit first");
        checkStopped();
        boolean trigger = false;
        for (CircuitElm elm : app.elmList) if (elm instanceof StopTriggerElm) trigger = true;
        if (!trigger) app.sim.stepCircuit(count);
        else for(int i=0;i<count;i++){app.sim.stepCircuit(1);if(EngineOutputSupport.stopRequested(app.elmList))break;}
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
            appendMeasurements(result,i,EngineOutputSupport.measurements(elm));
        }
        if(EngineOutputSupport.stopRequested(app.elmList))EngineOutputSupport.flag(result,"stopRequested",true);
        return result;
    }
    JavaScriptObject readCapture(int id){if(id<0||id>=app.elmList.size())throw new IllegalArgumentException("Invalid recorder ID");return EngineOutputSupport.capture(app.elmList.get(id),app.sim.t,app.sim.timeStep);}
    void setVariableVoltage(int id,double voltage){
        if(id<0||id>=app.elmList.size()||!(app.elmList.get(id) instanceof VarRailElm))throw new IllegalArgumentException("Expected variable source ID");
        VarRailElm elm=(VarRailElm)app.elmList.get(id);
        if(!finite(voltage)||voltage<elm.bias||voltage>elm.maxVoltage)throw new IllegalArgumentException("Voltage outside source range");
        checkStopped();elm.frequency=voltage;
    }
    private native void appendMeasurements(JavaScriptObject result,int id,JavaScriptObject values) /*-{ if(Object.keys(values).length)result.elements[id].measurements=values; }-*/;

    private native JavaScriptObject newSnapshot(double time, double timeStep, String error, boolean editorFree) /*-{
        return {time: time, timeStep: timeStep, error: error, editorFree: editorFree, elements: []};
    }-*/;

    private native void appendElement(JavaScriptObject result, int id, String type, double current, double[] volts) /*-{
        result.elements.push({id: id, type: type, current: current, voltages: Array.prototype.slice.call(volts)});
    }-*/;

    private native void publish() /*-{
        var that = this;
        $wnd.CircuitEngine = {
            readCapture: $entry(function(id){if(!Number.isInteger(id))throw new Error('Expected integer recorder ID');return that.@com.lushprojects.circuitjs1.client.EngineEntryPoint::readCapture(I)(id);}),
            setVariableVoltage: $entry(function(id,voltage){if(!Number.isInteger(id)||typeof voltage!=='number'||!isFinite(voltage))throw new Error('Invalid variable source update');that.@com.lushprojects.circuitjs1.client.EngineEntryPoint::setVariableVoltage(ID)(id,voltage);return that.@com.lushprojects.circuitjs1.client.EngineEntryPoint::snapshot()();}),
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
            updateCircuit: $entry(function(text,dt,retained) {
                that.@com.lushprojects.circuitjs1.client.EngineEntryPoint::updateCircuit(Ljava/lang/String;DLcom/google/gwt/core/client/JavaScriptObject;)(text,dt,retained);
                return that.@com.lushprojects.circuitjs1.client.EngineEntryPoint::snapshot()();
            }),
            setContact: $entry(function(id, position) {
                if (!Number.isInteger(id) || !Number.isInteger(position))
                    throw new Error("Contact ID and position must be integers");
                that.@com.lushprojects.circuitjs1.client.EngineEntryPoint::setContact(II)(id, position);
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
