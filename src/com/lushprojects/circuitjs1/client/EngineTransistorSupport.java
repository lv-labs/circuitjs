package com.lushprojects.circuitjs1.client;

/** Guarded BJT model records, including the extended junction-charge model. */
final class EngineTransistorSupport {
    static CircuitElm construct(String[] f,int x,int y,int x2,int y2,int flags) {
        if(!f[0].equals("t") || f.length==10)return null;
        EngineOutputSupport.require(f.length==11 || f.length==31,"Invalid transistor model format");
        EngineOutputSupport.require((flags>=0 && flags<=3) && x2-x==64 && y==32 && y2==32 &&
            (f[6].equals("1")||f[6].equals("-1")) && f[7].equals("0") && f[8].equals("0"),"Invalid transistor format");
        EngineOutputSupport.positive(f,9);
        TransistorModel.createModelMap();
        String name=f[10];
        if(name.equals("custom")){
            EngineOutputSupport.require(f.length==31,"Invalid custom transistor field count");
            for(int i=11;i<31;i++){
                double value=EngineOutputSupport.number(f,i);
                EngineOutputSupport.require(value>=0 && (value==0||EngineOutputSupport.finite(1/value)),"Invalid transistor model value");
            }
            EngineOutputSupport.positive(f,11,12,17,18,20,22,24,25,27,28);
            String values="";for(int i=11;i<31;i++)values+=":"+f[i];
            name="~react-bjt"+values;
            TransistorModel m=new TransistorModel(name,EngineOutputSupport.number(f,11));
            m.name=name;
            m.betaR=EngineOutputSupport.number(f,12);
            m.invEarlyVoltF=inverse(f,13);m.invEarlyVoltR=inverse(f,14);
            m.invRollOffF=inverse(f,15);m.invRollOffR=inverse(f,16);
            m.emissionCoeffF=EngineOutputSupport.number(f,17);m.emissionCoeffR=EngineOutputSupport.number(f,18);
            m.BEleakCur=EngineOutputSupport.number(f,19);m.leakBEemissionCoeff=EngineOutputSupport.number(f,20);
            m.BCleakCur=EngineOutputSupport.number(f,21);m.leakBCemissionCoeff=EngineOutputSupport.number(f,22);
            m.junctionCapBE=EngineOutputSupport.number(f,23);m.junctionPotBE=EngineOutputSupport.number(f,24);m.junctionExpBE=EngineOutputSupport.number(f,25);
            m.junctionCapBC=EngineOutputSupport.number(f,26);m.junctionPotBC=EngineOutputSupport.number(f,27);m.junctionExpBC=EngineOutputSupport.number(f,28);
            m.transitTimeF=EngineOutputSupport.number(f,29);m.transitTimeR=EngineOutputSupport.number(f,30);
            m.updateModel();TransistorModel.modelMap.put(name,m);
        }else EngineOutputSupport.require(f.length==11&&(name.equals("default")||name.equals("spice-default")),"Unknown transistor model");
        return new TransistorElm(x,y,x2,y2,flags,new StringTokenizer(f[6]+" 0 0 "+f[9]+" "+name));
    }
    static double inverse(String[] f,int i){double v=EngineOutputSupport.number(f,i);return v==0?0:1/v;}
}
