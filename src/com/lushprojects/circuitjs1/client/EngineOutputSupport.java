package com.lushprojects.circuitjs1.client;

import java.util.Vector;
import com.google.gwt.core.client.JavaScriptObject;

/** Guarded, editor-free construction and result access for output/source models. */
final class EngineOutputSupport {
    static boolean finite(double v) { return !Double.isNaN(v) && !Double.isInfinite(v); }
    static void require(boolean ok, String message) { if (!ok) throw new IllegalArgumentException(message); }
    static double number(String[] f, int i) { double v=Double.parseDouble(f[i]); require(finite(v), "Non-finite output parameter"); return v; }
    static int integer(String[] f, int i, int min, int max) { int v=Integer.parseInt(f[i]); require(v>=min && v<=max,"Invalid output integer parameter"); return v; }
    static void positive(String[] f, int... indices) { for(int i:indices) require(number(f,i)>0 && finite(1/number(f,i)),"Output parameter must be positive and finite"); }
    static native String decode(String value) /*-{ return value === '%00' ? '' : decodeURIComponent(value); }-*/;
    static CircuitElm construct(String[] f, double dt) {
        String type=f[0];
        int count=type.equals("172")?13:type.equals("181")?11:type.equals("207")?7:type.equals("p")?9:
            type.equals("216")||type.equals("370")||type.equals("420")||type.equals("368")||type.equals("419")||type.equals("405")||type.equals("instruction")?8:
            type.equals("210")?7:type.equals("211")||type.equals("408")?9:type.equals("415")?14:type.equals("427")?13:0;
        if(count==0)return null;
        require(f.length==count,"Invalid output/source field count");
        int x=Integer.parseInt(f[1]),y=Integer.parseInt(f[2]),x2=Integer.parseInt(f[3]),y2=Integer.parseInt(f[4]),flags=Integer.parseInt(f[5]);
        int allowed=type.equals("p")||type.equals("370")?3:type.equals("207")?4:type.equals("368")?1:0;
        require(flags==allowed,"Unsupported output/source flags");
        if(type.equals("420")||type.equals("419")||type.equals("405")||type.equals("427")||type.equals("instruction"))require(y==32&&y2==32&&x2-x==64,"Invalid output chip geometry");
        String args="";for(int i=6;i<f.length;i++)args+=f[i]+" ";
        StringTokenizer st=new StringTokenizer(args);
        if(type.equals("172")) {
            require(f[6].equals("6") && f[10].equals("0") && f[11].equals("0.5"),"Invalid variable source waveform");
            double v=number(f,7),hi=number(f,8),lo=number(f,9);require(lo<hi&&finite(hi-lo)&&v>=lo&&v<=hi,"Invalid variable source range/value");
            String label=decode(f[12]);require(label.length()<=80,"Source label too long");
            VarRailElm elm=new VarRailElm(x,y,x2,y2,0,new StringTokenizer("6 "+v+" "+hi+" "+lo+" 0 0.5 Voltage"));elm.sliderText=label;return elm;
        }
        if(type.equals("181")){require(number(f,6)>=300&&number(f,6)<=5000,"Invalid initial lamp temperature");positive(f,7,8,9,10);return new LampElm(x,y,x2,y2,0,st);}
        if(type.equals("207")){String name=decode(f[6]);require(name.length()>0&&name.length()<=256,"Invalid private net label");return new LabeledNodeElm(x,y,x2,y2,4,new StringTokenizer(CustomLogicModel.escape(name)));}
        if(type.equals("p")){integer(f,6,0,5);require(f[7].equals("0")&&number(f,8)>=0&&(number(f,8)==0||finite(1/number(f,8))),"Invalid voltmeter resistance/scale");return new ProbeElm(x,y,x2,y2,3,st);}
        if(type.equals("216")){require(number(f,6)>=0&&number(f,6)<=1,"Invalid test current");require(number(f,7)>=0,"Invalid current compliance");OhmMeterElm elm=new OhmMeterElm(x,y,x2,y2,0,st);elm.currentValue=number(f,6);return elm;}
        if(type.equals("370")){integer(f,6,0,1);require(f[7].equals("0"),"Invalid ammeter scale");return new AmmeterElm(x,y,x2,y2,3,st);}
        if(type.equals("420")){require(f[6].equals("32"),"Invalid wattmeter width");integer(f,7,0,1);return new WattmeterElm(x,y,x2,y2,0,st);}
        if(type.equals("368")){integer(f,6,0,5);String label=decode(f[7]);require(label.length()<=80,"Test-point label too long");return new TestPointElm(x,y,x2,y2,1,new StringTokenizer(f[6]+" "+CustomLogicModel.escape(label)));}
        if(type.equals("419")){require(f[6].equals("4"),"Display requires four bits");integer(f,7,0,2);return new DecimalDisplayElm(x,y,x2,y2,0,st);}
        if(type.equals("405")){require(f[6].equals("8")&&f[7].equals("8"),"LED array requires 8 by 8 pins");return new LEDArrayElm(x,y,x2,y2,0,st);}
        if(type.equals("instruction")){double threshold=number(f,6);String lookup=decode(f[7]);require(lookup.length()<=4096,"Lookup too long");return new EngineInstructionDisplay(x,y,x2,y2,threshold,lookup);}
        if(type.equals("210")){integer(f,6,1,100000);return new DataRecorderElm(x,y,x2,y2,0,st);}
        if(type.equals("211")){
            double duration=number(f,6);int rate=integer(f,7,8000,48000);
            require((rate==8000||rate==11025||rate==16000||rate==22050||rate==44100||rate==48000)&&duration>=.001&&duration<=10&&Math.floor(rate*duration)>=1&&rate*duration<=1000000&&dt<=1.0/rate&&f[8].equals("1"),"Invalid audio capture duration/rate/timestep");
            return new AudioOutputElm(x,y,x2,y2,0,st);
        }
        if(type.equals("408")){number(f,6);integer(f,7,0,1);require(number(f,8)>=0,"Trigger delay must be nonnegative");return new StopTriggerElm(x,y,x2,y2,0,st);}
        if(type.equals("415")){
            positive(f,6,7,10,11,12);require(number(f,8)>=0&&number(f,9)>=0,"Invalid motor constant");number(f,13);return new DCMotorElm(x,y,x2,y2,0,st);
        }
        positive(f,6,7,8,9,10,12);require(number(f,11)>=0,"Invalid motor friction");
        double det=number(f,8)*number(f,9)-number(f,10)*number(f,10);require(finite(det)&&det>0&&finite(1/det),"Invalid motor inductance matrix");
        return new ThreePhaseMotorElm(x,y,x2,y2,0,st);
    }
    // Only the post geometry changes: the original display's lookup/evaluation is reused.
    static final class EngineInstructionDisplay extends InstructionDisplayElm {
        EngineInstructionDisplay(int x,int y,int x2,int y2,double threshold,String lookup){super(x,y);this.x2=x2;this.y2=y2;this.threshold=threshold;lookupText=lookup;busWidth=4;parseEntries(null);allocNodes();}
        Point getPost(int n){return new Point(x,y+32*(3-n));}
        int getPostWidth(int n){return 1;}
    }
    static void initialize(CircuitElm elm){if(elm instanceof AudioOutputElm){AudioOutputElm e=(AudioOutputElm)elm;e.dataStart=CircuitElm.sim.t;e.nextDataSample=e.dataStart+e.sampleStep;e.dataSampleCount=0;e.dataSample=0;}}
    static boolean stopRequested(Vector<CircuitElm> elements){for(CircuitElm elm:elements)if(elm instanceof StopTriggerElm&&((StopTriggerElm)elm).stopped)return true;return false;}
    static JavaScriptObject measurements(CircuitElm elm){
        JavaScriptObject result=object();
        if(elm instanceof VarRailElm)put(result,"voltage",((VarRailElm)elm).frequency);
        else if(elm instanceof LampElm){LampElm e=(LampElm)elm;put(result,"temperature",e.temp);put(result,"resistance",e.resistance);put(result,"power",e.getPower());}
        else if(elm instanceof ProbeElm){ProbeElm e=(ProbeElm)elm;put(result,"value",meter(e.meter,e.getVoltageDiff(),e.rmsV,e.lastMaxV,e.lastMinV,e.binaryLevel));}
        else if(elm instanceof TestPointElm){TestPointElm e=(TestPointElm)elm;put(result,"value",meter(e.meter,e.volts[0],e.rmsV,e.lastMaxV,e.lastMinV,e.binaryLevel));}
        else if(elm instanceof OhmMeterElm){put(result,"value",elm.getCurrent()==0?Double.NaN:elm.getVoltageDiff()/elm.getCurrent());}
        else if(elm instanceof AmmeterElm){AmmeterElm e=(AmmeterElm)elm;put(result,"value",e.meter==0?e.current:e.rmsI);}
        else if(elm instanceof WattmeterElm){WattmeterElm e=(WattmeterElm)elm;put(result,"value",e.meter==0?e.getPower():e.avgPower);put(result,"voltage",e.getVoltageDiff());put(result,"current",e.getCurrent());}
        else if(elm instanceof DecimalDisplayElm){DecimalDisplayElm e=(DecimalDisplayElm)elm;int v=0;for(int i=0;i<4;i++)if(e.pins[i].value)v|=1<<i;put(result,"value",v);text(result,"text",Integer.toString(v,e.displayMode==1?16:e.displayMode==2?8:10).toUpperCase());}
        else if(elm instanceof InstructionDisplayElm)text(result,"text",((InstructionDisplayElm)elm).getDisplayText());
        else if(elm instanceof LEDArrayElm)array(result,"currents",((LEDArrayElm)elm).currents);
        else if(elm instanceof DataRecorderElm){DataRecorderElm e=(DataRecorderElm)elm;put(result,"samples",e.dataFull?e.dataCount:e.dataPtr);}
        else if(elm instanceof AudioOutputElm){AudioOutputElm e=(AudioOutputElm)elm;put(result,"samples",e.dataFull?e.dataCount:e.dataPtr);}
        else if(elm instanceof StopTriggerElm)flag(result,"stopped",((StopTriggerElm)elm).stopped);
        else if(elm instanceof DCMotorElm){DCMotorElm e=(DCMotorElm)elm;put(result,"speed",e.speed);put(result,"angle",e.angle);put(result,"current",e.coilCurrent);}
        else if(elm instanceof ThreePhaseMotorElm){ThreePhaseMotorElm e=(ThreePhaseMotorElm)elm;put(result,"speed",e.speed);put(result,"angle",e.angle);}
        else if (elm instanceof SweepElm) put(result,"frequency",((SweepElm) elm).frequency);
        else if (elm instanceof SparkGapElm) flag(result,"conducting",((SparkGapElm) elm).state);
        else if (elm instanceof FuseElm) flag(result,"blown",((FuseElm) elm).blown);
        else if (elm instanceof MemristorElm) put(result,"resistance",((MemristorElm) elm).resistance);
        else if (elm instanceof LDRElm) {
            LDRElm e = (LDRElm) elm; put(result,"lux",e.lux); put(result,"resistance",e.resistance);
        } else if (elm instanceof ThermistorNTCElm) {
            ThermistorNTCElm e = (ThermistorNTCElm) elm;
            put(result,"temperature",e.temperature); put(result,"resistance",e.resistance);
        }
        else if (elm instanceof SCRElm) put(result,"anodeCurrent",((SCRElm) elm).ia);
        else if (elm instanceof DiacElm) flag(result,"conducting",((DiacElm) elm).state);
        else if (elm instanceof TriacElm) flag(result,"conducting",((TriacElm) elm).state);
        else if (elm instanceof VaractorElm) put(result,"capacitance",((VaractorElm) elm).capacitance);
        return result;
    }
    static double meter(int mode,double v,double rms,double max,double min,double binary){return mode==0?v:mode==1?rms:mode==2?max:mode==3?min:mode==4?max-min:binary;}
    static JavaScriptObject capture(CircuitElm elm,double now,double dt){
        double[] data;int ptr,count;double step,start;
        if(elm instanceof DataRecorderElm){DataRecorderElm e=(DataRecorderElm)elm;data=e.data;ptr=e.dataFull?e.dataPtr:0;count=e.dataFull?e.dataCount:e.dataPtr;step=dt;start=count==0?now:now-count*dt;}
        else if(elm instanceof AudioOutputElm){AudioOutputElm e=(AudioOutputElm)elm;data=e.data;ptr=e.dataFull?e.dataPtr:0;count=e.dataFull?e.dataCount:e.dataPtr;step=e.sampleStep;start=e.dataFull?e.nextDataSample-count*step:e.dataStart+step;}
        else throw new IllegalArgumentException("Expected data/audio recorder");
        double[] values=new double[count];for(int i=0;i<count;i++)values[i]=data[(ptr+i)%data.length];
        JavaScriptObject result=object();array(result,"values",values);put(result,"timeStep",step);put(result,"startTime",start);return result;
    }
    static native JavaScriptObject object() /*-{return {};}-*/;
    static native void put(JavaScriptObject obj,String key,double value) /*-{obj[key]=isFinite(value)?value:null;}-*/;
    static native void text(JavaScriptObject obj,String key,String value) /*-{obj[key]=value;}-*/;
    static native void flag(JavaScriptObject obj,String key,boolean value) /*-{obj[key]=value;}-*/;
    static native void array(JavaScriptObject obj,String key,double[] values) /*-{obj[key]=values?Array.prototype.slice.call(values):[];}-*/;
}
