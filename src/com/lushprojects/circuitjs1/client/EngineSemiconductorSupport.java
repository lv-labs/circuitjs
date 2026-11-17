package com.lushprojects.circuitjs1.client;

/** Guarded construction for the native thyristor, varactor and vacuum-tube models. */
final class EngineSemiconductorSupport {
    static CircuitElm construct(String[] fields, int x, int y, int x2, int y2, int flags, double dt) {
        String type = fields[0];
        boolean scr = type.equals("177"), diac = type.equals("203"), triac = type.equals("206");
        boolean varactor = type.equals("176"), triode = type.equals("173");
        if (!(scr || diac || triac || varactor || triode)) return null;

        EngineOutputSupport.require(fields.length == (scr ? 11 : diac || triac ? 10 : 8) &&
            flags == (scr ? 1 : triode ? 2 : 0), "Invalid semiconductor model format");
        boolean three = scr || triac || triode;
        EngineOutputSupport.require(y == 32 && (three ? x2 - x == 64 && y2 == 32 : x == x2 && y2 == 64),
            "Invalid semiconductor model geometry");
        String args = "";
        for (int i = 6; i < fields.length; i++) args += fields[i] + " ";
        StringTokenizer tokens = new StringTokenizer(args);
        if (scr) {
            EngineOutputSupport.require(fields[6].equals("0") && fields[7].equals("0"), "Invalid initial SCR state");
            EngineOutputSupport.positive(fields, 8, 9, 10);
            return new SCRElm(x, y, x2, y2, flags, tokens);
        }
        if (diac) {
            EngineOutputSupport.positive(fields, 6, 7, 8);
            EngineOutputSupport.require(EngineOutputSupport.number(fields, 7) >= EngineOutputSupport.number(fields, 6) &&
                EngineOutputSupport.number(fields, 9) >= 0, "Invalid DIAC resistance or holding current");
            return new DiacElm(x, y, x2, y2, flags, tokens);
        }
        if (triac) {
            EngineOutputSupport.positive(fields, 6, 7, 8);
            EngineOutputSupport.require(fields[9].equals("false"), "Invalid initial TRIAC state");
            return new TriacElm(x, y, x2, y2, flags, tokens);
        }
        if (varactor) {
            EngineOutputSupport.require(fields[6].equals("0"), "Invalid initial varactor bias");
            EngineOutputSupport.positive(fields, 7);
            EngineOutputSupport.require(EngineOutputSupport.finite(dt / EngineOutputSupport.number(fields, 7)),
                "Invalid varactor companion resistance");
            return new VaractorElm(x, y, x2, y2, flags, tokens);
        }
        EngineOutputSupport.positive(fields, 6, 7);
        return new TriodeElm(x, y, x2, y2, flags, tokens);
    }

    static void configure(CircuitElm old, CircuitElm fresh) {
        if (old instanceof SCRElm) {
            SCRElm a = (SCRElm) old, b = (SCRElm) fresh;
            a.triggerI = b.triggerI; a.holdingI = b.holdingI; a.gresistance = b.gresistance;
        } else if (old instanceof DiacElm) {
            DiacElm a = (DiacElm) old, b = (DiacElm) fresh;
            a.onresistance = b.onresistance; a.offresistance = b.offresistance; a.breakdown = b.breakdown;
            a.holdcurrent = b.holdcurrent;
        } else if (old instanceof TriacElm) {
            TriacElm a = (TriacElm) old, b = (TriacElm) fresh;
            a.triggerI = b.triggerI; a.holdingI = b.holdingI; a.cresistance = b.cresistance;
        } else if (old instanceof VaractorElm) {
            ((VaractorElm) old).baseCapacitance = ((VaractorElm) fresh).baseCapacitance;
        } else if (old instanceof TriodeElm) {
            TriodeElm a = (TriodeElm) old, b = (TriodeElm) fresh;
            a.mu = b.mu; a.kg1 = b.kg1;
        }
    }
}
