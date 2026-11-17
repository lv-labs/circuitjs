package com.lushprojects.circuitjs1.client;

/** Safe worker construction for native nonlinear and sensor passives. */
final class EnginePassiveSupport {
    private static void require(boolean ok, String message) {
        if (!ok) throw new IllegalArgumentException(message);
    }

    private static double number(String[] fields, int index) {
        double value = Double.parseDouble(fields[index]);
        require(EngineOutputSupport.finite(value), "Non-finite passive parameter");
        return value;
    }

    private static double positive(String[] fields, int index) {
        double value = number(fields, index);
        require(value > 0 && EngineOutputSupport.finite(1 / value), "Expected positive passive parameter");
        return value;
    }

    static CircuitElm construct(String[] fields, int x, int y, int x2, int y2, int flags, double dt) {
        String type = fields[0];
        int count;
        switch (type) {
            case "175": count = 6; break;
            case "374": count = 8; break;
            case "187": case "404": count = 10; break;
            case "350": case "m": count = 12; break;
            default: return null;
        }
        require(fields.length == count && flags == 0, "Invalid passive model format");
        require(x == x2 && y == 32 && y2 == 64, "Invalid passive model geometry");
        String args = "";
        for (int i = 6; i < fields.length; i++) args += fields[i] + " ";
        StringTokenizer tokens = new StringTokenizer(args);
        switch (type) {
            case "175":
                return new TunnelDiodeElm(x, y, x2, y2, flags, tokens);
            case "187": {
                double on = positive(fields, 6), off = positive(fields, 7);
                positive(fields, 8);
                require(off >= on && number(fields, 9) >= 0, "Invalid spark gap resistance or holding current");
                return new SparkGapElm(x, y, x2, y2, flags, tokens);
            }
            case "m": {
                double on = positive(fields, 6), off = positive(fields, 7), width = positive(fields, 9);
                double initial = number(fields, 8), mobility = number(fields, 10);
                require(off >= on && initial >= 0 && initial <= width && mobility >= 0 &&
                    EngineOutputSupport.finite(dt * mobility * on / width) && fields[11].equals("0"),
                    "Invalid memristor resistance, width, or mobility");
                return new MemristorElm(x, y, x2, y2, flags, tokens);
            }
            case "404":
                positive(fields, 6);
                positive(fields, 7);
                require(fields[8].equals("0") && fields[9].equals("false"), "Invalid initial fuse state");
                return new FuseElm(x, y, x2, y2, flags, tokens);
            case "374": {
                double position = number(fields, 6);
                require(position >= 0 && position <= 1 && fields[7].equals("Light"), "Invalid light sensor position");
                return new LDRElm(x, y, x2, y2, flags, tokens);
            }
            default: {
                double r25 = positive(fields, 6), r50 = positive(fields, 7);
                double min = number(fields, 8), max = number(fields, 9), position = number(fields, 10);
                require(r25 > r50 && min > -273.15 && max > min && EngineOutputSupport.finite(max - min) &&
                    position >= 0 && position <= 1 && fields[11].equals("Temperature"),
                    "Invalid thermistor resistance or temperature range");
                ThermistorNTCElm elm = new ThermistorNTCElm(x, y, x2, y2, flags, tokens);
                require(elm.calcResistance(Math.round(max)) > 0 && elm.resistance > 0,
                    "Thermistor resistance must remain positive across its temperature range");
                return elm;
            }
        }
    }

    static void configure(CircuitElm old, CircuitElm fresh) {
        if (old instanceof SparkGapElm) {
            SparkGapElm a = (SparkGapElm) old, b = (SparkGapElm) fresh;
            a.onresistance = b.onresistance; a.offresistance = b.offresistance;
            a.breakdown = b.breakdown; a.holdcurrent = b.holdcurrent;
        } else if (old instanceof MemristorElm) {
            MemristorElm a = (MemristorElm) old, b = (MemristorElm) fresh;
            a.r_on = b.r_on; a.r_off = b.r_off; a.totalWidth = b.totalWidth; a.mobility = b.mobility;
            a.dopeWidth = Math.min(a.dopeWidth, a.totalWidth);
        } else if (old instanceof FuseElm) {
            FuseElm a = (FuseElm) old, b = (FuseElm) fresh;
            a.resistance = b.resistance; a.i2t = b.i2t;
        } else if (old instanceof LDRElm) {
            ((LDRElm) old).position = ((LDRElm) fresh).position;
        } else if (old instanceof ThermistorNTCElm) {
            ThermistorNTCElm a = (ThermistorNTCElm) old, b = (ThermistorNTCElm) fresh;
            a.r25 = b.r25; a.r50 = b.r50; a.minTempr = b.minTempr; a.maxTempr = b.maxTempr;
            a.position = b.position; a.b25100 = b.b25100; a.rneg40 = b.rneg40;
        }
    }
}
