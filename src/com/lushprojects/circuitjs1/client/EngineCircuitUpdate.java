package com.lushprojects.circuitjs1.client;

/** Copy editable configuration, never live state, onto retained legacy elements. */
final class EngineCircuitUpdate {
    static void configure(CircuitElm old, CircuitElm fresh) {
        old.flags=fresh.flags;
        if(old instanceof VoltageElm && !(old instanceof VarRailElm)){
            VoltageElm a=(VoltageElm)old,b=(VoltageElm)fresh;
            if(a.frequency!=b.frequency)a.freqTimeZero=b.frequency==0?0:CircuitElm.sim.t-a.frequency*(CircuitElm.sim.t-a.freqTimeZero)/b.frequency;
        }
        if(old instanceof ResistorElm){ResistorElm a=(ResistorElm)old,b=(ResistorElm)fresh;a.resistance=b.resistance;}
        if(old instanceof CapacitorElm){CapacitorElm a=(CapacitorElm)old,b=(CapacitorElm)fresh;a.capacitance=b.capacitance;a.initialVoltage=b.initialVoltage;}
        if(old instanceof PolarCapacitorElm){PolarCapacitorElm a=(PolarCapacitorElm)old,b=(PolarCapacitorElm)fresh;a.maxNegativeVoltage=b.maxNegativeVoltage;}
        if(old instanceof VoltageElm){VoltageElm a=(VoltageElm)old,b=(VoltageElm)fresh;a.waveform=b.waveform;a.frequency=b.frequency;a.maxVoltage=b.maxVoltage;a.bias=b.bias;a.phaseShift=b.phaseShift;a.dutyCycle=b.dutyCycle;a.riseTime=b.riseTime;}
        if(old instanceof VarRailElm){VarRailElm a=(VarRailElm)old,b=(VarRailElm)fresh;a.sliderText=b.sliderText;}
        if(old instanceof CurrentElm){CurrentElm a=(CurrentElm)old,b=(CurrentElm)fresh;a.currentValue=b.currentValue;a.maxVoltage=b.maxVoltage;}
        if(old instanceof PotElm){PotElm a=(PotElm)old,b=(PotElm)fresh;a.position=b.position;a.maxResistance=b.maxResistance;a.sliderText=b.sliderText;}
        if(old instanceof SwitchElm){SwitchElm a=(SwitchElm)old,b=(SwitchElm)fresh;a.position=b.position;}
        if(old instanceof LogicInputElm){LogicInputElm a=(LogicInputElm)old,b=(LogicInputElm)fresh;a.hiV=b.hiV;a.loV=b.loV;}
        if(old instanceof LogicOutputElm){LogicOutputElm a=(LogicOutputElm)old,b=(LogicOutputElm)fresh;a.threshold=b.threshold;}
        if(old instanceof OpAmpElm){OpAmpElm a=(OpAmpElm)old,b=(OpAmpElm)fresh;a.maxOut=b.maxOut;a.minOut=b.minOut;a.gain=b.gain;a.gbw=b.gbw;}
        if(old instanceof AnalogSwitchElm){AnalogSwitchElm a=(AnalogSwitchElm)old,b=(AnalogSwitchElm)fresh;a.r_on=b.r_on;a.r_off=b.r_off;a.threshold=b.threshold;}
        if(old instanceof TransistorElm){TransistorElm a=(TransistorElm)old,b=(TransistorElm)fresh;a.beta=b.beta;}
        if(old instanceof MosfetElm){MosfetElm a=(MosfetElm)old,b=(MosfetElm)fresh;a.vt=b.vt;a.beta=b.beta;}
        if(old instanceof GateElm){GateElm a=(GateElm)old,b=(GateElm)fresh;a.highVoltage=b.highVoltage;a.propagationDelay=b.propagationDelay;}
        if(old instanceof InverterElm){InverterElm a=(InverterElm)old,b=(InverterElm)fresh;a.slewRate=b.slewRate;a.highVoltage=b.highVoltage;}
        if(old instanceof ChipElm){ChipElm a=(ChipElm)old,b=(ChipElm)fresh;a.highVoltage=b.highVoltage;}
        if(old instanceof CounterElm){CounterElm a=(CounterElm)old,b=(CounterElm)fresh;a.modulus=b.modulus;a.invertreset=b.invertreset;}
        if(old instanceof TransformerElm){TransformerElm a=(TransformerElm)old,b=(TransformerElm)fresh;a.inductance=b.inductance;a.ratio=b.ratio;a.couplingCoef=b.couplingCoef;a.saturationCurrent=b.saturationCurrent;}
        if(old instanceof TappedTransformerElm){TappedTransformerElm a=(TappedTransformerElm)old,b=(TappedTransformerElm)fresh;a.inductance=b.inductance;a.ratio=b.ratio;a.couplingCoef=b.couplingCoef;}
        if(old instanceof CustomTransformerElm){CustomTransformerElm a=(CustomTransformerElm)old,b=(CustomTransformerElm)fresh;a.inductance=b.inductance;a.couplingCoef=b.couplingCoef;a.description=b.description;}
        if(old instanceof LampElm){LampElm a=(LampElm)old,b=(LampElm)fresh;a.nom_pow=b.nom_pow;a.nom_v=b.nom_v;a.warmTime=b.warmTime;a.coolTime=b.coolTime;}
        if(old instanceof DCMotorElm){DCMotorElm a=(DCMotorElm)old,b=(DCMotorElm)fresh;a.resistance=b.resistance;a.inductance=b.inductance;a.K=b.K;a.Kb=b.Kb;a.J=b.J;a.b=b.b;a.gearRatio=b.gearRatio;a.tau=b.tau;}
        if(old instanceof ThreePhaseMotorElm){ThreePhaseMotorElm a=(ThreePhaseMotorElm)old,b=(ThreePhaseMotorElm)fresh;a.Rs=b.Rs;a.Rr=b.Rr;a.Ls=b.Ls;a.Lr=b.Lr;a.Lm=b.Lm;a.b=b.b;a.J=b.J;}
        if(old instanceof ProbeElm){ProbeElm a=(ProbeElm)old,b=(ProbeElm)fresh;a.meter=b.meter;a.resistance=b.resistance;}
        if(old instanceof TestPointElm){TestPointElm a=(TestPointElm)old,b=(TestPointElm)fresh;a.meter=b.meter;a.label=b.label;}
        if(old instanceof AmmeterElm){AmmeterElm a=(AmmeterElm)old,b=(AmmeterElm)fresh;a.meter=b.meter;}
        if(old instanceof WattmeterElm){WattmeterElm a=(WattmeterElm)old,b=(WattmeterElm)fresh;a.meter=b.meter;}
        if(old instanceof DecimalDisplayElm){DecimalDisplayElm a=(DecimalDisplayElm)old,b=(DecimalDisplayElm)fresh;a.displayMode=b.displayMode;}
        if(old instanceof InstructionDisplayElm){InstructionDisplayElm a=(InstructionDisplayElm)old,b=(InstructionDisplayElm)fresh;a.threshold=b.threshold;a.lookupText=b.lookupText;}
        if(old instanceof StopTriggerElm){StopTriggerElm a=(StopTriggerElm)old,b=(StopTriggerElm)fresh;a.triggerVoltage=b.triggerVoltage;a.delay=b.delay;a.type=b.type;}
        if(old instanceof LEDElm){LEDElm a=(LEDElm)old,b=(LEDElm)fresh;a.maxBrightnessCurrent=b.maxBrightnessCurrent;a.colorR=b.colorR;a.colorG=b.colorG;a.colorB=b.colorB;}
        if(old instanceof InductorElm){InductorElm a=(InductorElm)old,b=(InductorElm)fresh;a.inductance=b.inductance;a.initialCurrent=b.initialCurrent;a.saturationCurrent=b.saturationCurrent;a.ind.setup(a.inductance,a.current,a.flags,a.saturationCurrent);}
        if(old instanceof DCMotorElm){DCMotorElm a=(DCMotorElm)old;a.ind.setup(a.inductance,a.coilCurrent,Inductor.FLAG_BACK_EULER);a.indInertia.setup(a.J,a.inertiaCurrent,Inductor.FLAG_BACK_EULER);}
        if(old instanceof CustomTransformerElm)((CustomTransformerElm)old).parseDescription();
        if(old instanceof DiodeElm){DiodeElm a=(DiodeElm)old,b=(DiodeElm)fresh;a.modelName=b.modelName;a.setup();}
        if(old instanceof TransistorElm)((TransistorElm)old).setup();
        if(old instanceof InstructionDisplayElm)((InstructionDisplayElm)old).parseEntries(null);
        if(old instanceof TransLineElm){TransLineElm a=(TransLineElm)old,b=(TransLineElm)fresh;if(a.delay!=b.delay){a.delay=b.delay;a.reset();}a.imped=b.imped;}
        if(old instanceof DataRecorderElm){DataRecorderElm a=(DataRecorderElm)old,b=(DataRecorderElm)fresh;if(a.dataCount!=b.dataCount){a.dataCount=b.dataCount;a.data=b.data;a.dataPtr=0;a.dataFull=false;}}
        if(old instanceof AudioOutputElm){AudioOutputElm a=(AudioOutputElm)old,b=(AudioOutputElm)fresh;if(a.duration!=b.duration||a.samplingRate!=b.samplingRate){a.duration=b.duration;a.samplingRate=b.samplingRate;a.dataCount=b.dataCount;a.data=b.data;a.sampleStep=b.sampleStep;a.reset();EngineOutputSupport.initialize(a);}}
    }
}
