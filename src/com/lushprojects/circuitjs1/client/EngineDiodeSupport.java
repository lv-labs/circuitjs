package com.lushprojects.circuitjs1.client;

/** Named/custom diode records. Existing forward-voltage records retain their old path. */
final class EngineDiodeSupport {
    static CircuitElm construct(String[] f, int x, int y, int x2, int y2, int flags) {
        String type=f[0];
        if (!(type.equals("d") || type.equals("z") || type.equals("162")) || flags != 2) return null;
        boolean led=type.equals("162");
        EngineOutputSupport.require(f.length >= 7, "Missing diode model");
        boolean custom=f[6].equals("custom");
        int end=custom?11:7;
        EngineOutputSupport.require(f.length == end+(led?4:0), "Invalid diode field count");
        String name=f[6];
        DiodeModel.createModelMap();
        DiodeModel model;
        if(custom) {
            EngineOutputSupport.positive(f,7,9);
            double sc=EngineOutputSupport.number(f,7),rs=EngineOutputSupport.number(f,8);
            double n=EngineOutputSupport.number(f,9),bv=EngineOutputSupport.number(f,10);
            EngineOutputSupport.require(rs>=0 && bv>=0 && (rs==0 || EngineOutputSupport.finite(1/rs)) &&
                EngineOutputSupport.finite(1/(n*DiodeModel.vt)) &&
                EngineOutputSupport.finite(Math.log(1/sc+1)*n*DiodeModel.vt), "Invalid custom diode model");
            // Content-addressed private names avoid mutations to other circuits or retained models.
            name="~react-diode:"+f[7]+":"+f[8]+":"+f[9]+":"+f[10];
            model=new DiodeModel(sc,rs,n,bv,null);
            model.name=name;
            DiodeModel.modelMap.put(name,model);
        } else {
            model=DiodeModel.modelMap.get(name);
            EngineOutputSupport.require(model!=null && model.builtIn && !model.internal, "Unknown diode model");
        }
        EngineOutputSupport.require(!type.equals("z") || model.breakdownVoltage>0, "Zener requires breakdown voltage");
        String args=name;
        if(led) {
            for(int i=end;i<end+3;i++) {
                double color=EngineOutputSupport.number(f,i);
                EngineOutputSupport.require(color>=0 && color<=1,"Invalid LED color");
                args+=" "+f[i];
            }
            EngineOutputSupport.positive(f,end+3);
            args+=" "+f[end+3];
        }
        StringTokenizer tokens=new StringTokenizer(args);
        return led?new LEDElm(x,y,x2,y2,flags,tokens):type.equals("z")?
            new ZenerElm(x,y,x2,y2,flags,tokens):new DiodeElm(x,y,x2,y2,flags,tokens);
    }
}
