package com.lushprojects.circuitjs1.client;

/** Extended switch configuration; old fixed-format records retain their old path. */
final class EngineSwitchSupport {
    static CircuitElm construct(String[] f,int x,int y,int x2,int y2,int flags){
        String type=f[0];
        boolean spst=type.equals("s"),spdt=type.equals("S"),dpdt=type.equals("429"),mbb=type.equals("416");
        if(!(spst||spdt||dpdt||mbb))return null;
        if(f.length==(spst?8:spdt?10:9))return null;
        EngineOutputSupport.require(f.length==(spst?10:spdt?12:11)&&flags>=0&&flags<=3,"Invalid switch format");
        EngineOutputSupport.require(f[7].equals("true")||f[7].equals("false"),"Invalid momentary state");
        double resistance=EngineOutputSupport.number(f,8);
        EngineOutputSupport.require(resistance>=0&&(resistance==0||EngineOutputSupport.finite(1/resistance)),"Invalid switch resistance");
        String label=EngineOutputSupport.decode(f[9]);
        EngineOutputSupport.require(label.length()<=80,"Switch label too long");
        int pos=EngineOutputSupport.integer(f,6,0,mbb?3:spdt?9:1),count=2,group=0;
        if(spdt){group=EngineOutputSupport.integer(f,10,0,1000);count=EngineOutputSupport.integer(f,11,2,10);
            EngineOutputSupport.require(pos<(((flags&1)!=0&&count==2)?3:count)&&!(count>2&&f[7].equals("true")),"Invalid switch throws or position");}
        if(dpdt)count=EngineOutputSupport.integer(f,10,1,8);
        if(mbb)group=EngineOutputSupport.integer(f,10,0,1000);
        String args=f[6]+" "+f[7]+(label.length()==0?"":" "+CustomLogicModel.escape(label));
        if(label.length()>0)flags|=4;
        if(spdt)args+=" "+group+" "+count;
        if(dpdt)args+=" "+count;
        if(mbb)args+=" "+group;
        StringTokenizer tokens=new StringTokenizer(args);
        SwitchElm elm=spst?new SwitchElm(x,y,x2,y2,flags,tokens):spdt?new Switch2Elm(x,y,x2,y2,flags,tokens):
            dpdt?new DPDTSwitchElm(x,y,x2,y2,flags,tokens):new MBBSwitchElm(x,y,x2,y2,flags,tokens);
        elm.resistance=resistance;
        elm.allocNodes();
        return elm;
    }
}
