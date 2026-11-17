package com.lushprojects.circuitjs1.client;

/** Validated worker records for the bundled signal generators and Schmitt triggers. */
final class EngineSourceSupport {
    private static void require(boolean ok, String message) {
        if (!ok) throw new IllegalArgumentException(message);
    }

    private static double number(String[] fields, int index) {
        double value = Double.parseDouble(fields[index]);
        require(finite(value), "Non-finite signal parameter");
        return value;
    }

    private static boolean finite(double value) {
        return !Double.isNaN(value) && !Double.isInfinite(value);
    }

    private static void frequency(double hz) {
        require(hz >= 0 && finite(2 * Math.PI * hz), "Invalid signal frequency");
    }

    static CircuitElm construct(String[] fields, int x, int y, int x2, int y2, int flags, double dt) {
        String type = fields[0];
        boolean sweep = type.equals("170");
        boolean am = type.equals("200");
        boolean fm = type.equals("201");
        boolean antenna = type.equals("A");
        boolean noise = type.equals("R") && fields.length > 6 && fields[6].equals("6");
        boolean schmitt = type.equals("182") || type.equals("183");
        if (!(sweep || am || fm || antenna || noise || schmitt)) return null;

        require(x == x2 && y == 32 && y2 == 64, "Invalid signal model geometry");
        require(sweep ? flags >= 0 && flags <= 3 : flags == 0, "Invalid signal model flags");
        if (antenna) {
            require(fields.length == 6, "Antenna has no configurable parameters");
            return new AntennaElm(x, y, x2, y2, flags, new StringTokenizer("1 40 5 0 0 0.5"));
        }
        if (noise) {
            require(fields.length == 12 && fields[7].equals("40") &&
                fields[10].equals("0") && fields[11].equals("0.5"), "Invalid noise waveform format");
            double amplitude = number(fields, 8), offset = number(fields, 9);
            require(amplitude >= 0 && finite(offset + amplitude) && finite(offset - amplitude),
                "Invalid noise amplitude or offset");
            return new NoiseElm(x, y, x2, y2, flags, new StringTokenizer("6 40 " +
                fields[8] + " " + fields[9] + " 0 0.5"));
        }
        if (schmitt) {
            require(fields.length == 11, "Expected five Schmitt trigger parameters");
            double slew = number(fields, 6), lower = number(fields, 7), upper = number(fields, 8);
            double high = number(fields, 9), low = number(fields, 10);
            require(slew > 0 && lower < upper && low < high && finite(high - low),
                "Schmitt trigger requires positive slew rate and ordered thresholds and output levels");
            StringTokenizer tokens = new StringTokenizer(fields[6] + " " + fields[7] + " " +
                fields[8] + " " + fields[9] + " " + fields[10]);
            return type.equals("182") ? new SchmittElm(x, y, x2, y2, flags, tokens) :
                new InvertingSchmittElm(x, y, x2, y2, flags, tokens);
        }

        require(fields.length == (am ? 9 : 10), "Invalid signal generator field count");
        double first = number(fields, 6), second = number(fields, 7), peak = number(fields, 8);
        frequency(first);
        frequency(second);
        require(peak >= 0, "Expected nonnegative peak voltage");
        String parameters = fields[6] + " " + fields[7] + " " + fields[8];
        if (am) return new AMElm(x, y, x2, y2, flags, new StringTokenizer(parameters));

        double fourth = number(fields, 9);
        StringTokenizer tokens = new StringTokenizer(parameters + " " + fields[9]);
        if (fm) {
            require(fourth >= 0, "Expected nonnegative frequency deviation");
            frequency(first + fourth);
            return new FMElm(x, y, x2, y2, flags, tokens);
        }

        require(first > 0 && second >= first && fourth >= dt, "Invalid sweep range or duration");
        if ((flags & 1) != 0) {
            double ratio = second / first, multiplier = Math.pow(ratio, dt / fourth);
            require(finite(ratio) && finite(multiplier * second), "Invalid logarithmic sweep rate");
        } else {
            require(finite(dt * (second - first) / fourth + second), "Invalid linear sweep rate");
        }
        return new SweepElm(x, y, x2, y2, flags, tokens);
    }

    static void initialize(CircuitElm elm) {
        if (elm instanceof FMElm) ((FMElm) elm).lasttime = CircuitElm.sim.t;
    }

    static void configure(CircuitElm old, CircuitElm fresh) {
        if (old instanceof SweepElm) {
            SweepElm a = (SweepElm) old, b = (SweepElm) fresh;
            a.minF = b.minF; a.maxF = b.maxF; a.maxV = b.maxV; a.sweepTime = b.sweepTime;
            a.savedTimeStep = Double.NaN;
        } else if (old instanceof AMElm) {
            AMElm a = (AMElm) old, b = (AMElm) fresh;
            a.carrierfreq = b.carrierfreq; a.signalfreq = b.signalfreq; a.maxVoltage = b.maxVoltage;
        } else if (old instanceof FMElm) {
            FMElm a = (FMElm) old, b = (FMElm) fresh;
            a.carrierfreq = b.carrierfreq; a.signalfreq = b.signalfreq; a.maxVoltage = b.maxVoltage; a.deviation = b.deviation;
        } else if (old instanceof InvertingSchmittElm) {
            InvertingSchmittElm a = (InvertingSchmittElm) old, b = (InvertingSchmittElm) fresh;
            a.slewRate = b.slewRate; a.lowerTrigger = b.lowerTrigger; a.upperTrigger = b.upperTrigger;
            a.logicOnLevel = b.logicOnLevel; a.logicOffLevel = b.logicOffLevel;
        }
    }
}
