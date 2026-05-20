package com.lushprojects.circuitjs1.client;

public class Theme {
    private static String uiControlBg;
    private static String uiSurface;
    private static String uiSurface2;
    private static String uiBorder;
    private static String uiText;
    private static String uiMuted;
    private static String uiAccent;
    private static String uiFont;
    private static String uiFontSize;
    private static String uiFontSizeSmall;
    private static String uiFontWeight;
    private static String uiFontWeightStrong;
    private static String canvasBg;
    private static String canvasGrid;
    private static String scopeBg;
    private static String scopeIcon;
    private static String scopePlotVoltage;
    private static String scopePlotCurrent;
    private static String scopePlotNeutral;
    private static String[] scopePlotPalette;

    public static String uiControlBg() {
        if (uiControlBg == null)
            uiControlBg = getCssVar("--ui-control-bg", "#323232");
        return uiControlBg;
    }

    public static String uiSurface() {
        if (uiSurface == null)
            uiSurface = getCssVar("--ui-surface", "#262626");
        return uiSurface;
    }

    public static String uiSurface2() {
        if (uiSurface2 == null)
            uiSurface2 = getCssVar("--ui-surface-2", "#2f2f2f");
        return uiSurface2;
    }

    public static String uiBorder() {
        if (uiBorder == null)
            uiBorder = getCssVar("--ui-border", "#3f3f46");
        return uiBorder;
    }

    public static String uiText() {
        if (uiText == null)
            uiText = getCssVar("--ui-text", "#fafafa");
        return uiText;
    }

    public static String uiMuted() {
        if (uiMuted == null)
            uiMuted = getCssVar("--ui-muted", "#a1a1aa");
        return uiMuted;
    }

    public static String uiAccent() {
        if (uiAccent == null)
            uiAccent = getCssVar("--ui-accent", "#e1a34d");
        return uiAccent;
    }

    public static String uiFont() {
        if (uiFont == null)
            uiFont = getCssVar("--ui-font",
                    "\"Geist Mono\", \"IBM Plex Mono\", \"SFMono-Regular\", \"SF Mono\", \"Cascadia Mono\", \"Roboto Mono\", \"Menlo\", \"Monaco\", \"Liberation Mono\", monospace");
        return uiFont;
    }

    public static String uiFontSize() {
        if (uiFontSize == null)
            uiFontSize = getCssVar("--ui-font-size", "12px");
        return uiFontSize;
    }

    public static String uiFontSizeSmall() {
        if (uiFontSizeSmall == null)
            uiFontSizeSmall = getCssVar("--ui-font-size-sm", "12px");
        return uiFontSizeSmall;
    }

    public static String uiFontWeight() {
        if (uiFontWeight == null)
            uiFontWeight = getCssVar("--ui-font-weight", "500");
        return uiFontWeight;
    }

    public static String uiFontWeightStrong() {
        if (uiFontWeightStrong == null)
            uiFontWeightStrong = getCssVar("--ui-font-weight-strong", "600");
        return uiFontWeightStrong;
    }

    public static String canvasBg() {
        if (canvasBg == null)
            canvasBg = getCssVar("--canvas-bg", "#1f1f1f");
        return canvasBg;
    }

    public static String canvasGrid() {
        if (canvasGrid == null)
            canvasGrid = getCssVar("--canvas-grid", "rgba(250, 250, 250, 0.07)");
        return canvasGrid;
    }

    public static String scopeBg() {
        if (scopeBg == null)
            scopeBg = getCssVar("--scope-bg", "#222222");
        return scopeBg;
    }

    public static String scopeIcon() {
        if (scopeIcon == null)
            scopeIcon = getCssVar("--scope-icon", "#a1a1aa");
        return scopeIcon;
    }

    public static String scopePlotVoltage() {
        if (scopePlotVoltage == null)
            scopePlotVoltage = getCssVar("--scope-plot-voltage", "#c9ff4d");
        return scopePlotVoltage;
    }

    public static String scopePlotCurrent() {
        if (scopePlotCurrent == null)
            scopePlotCurrent = getCssVar("--scope-plot-current", "#fff36b");
        return scopePlotCurrent;
    }

    public static String scopePlotNeutral() {
        if (scopePlotNeutral == null)
            scopePlotNeutral = getCssVar("--scope-plot-neutral", "#fafafa");
        return scopePlotNeutral;
    }

    public static String scopePlotColor(int index) {
        if (scopePlotPalette == null) {
            scopePlotPalette = new String[] {
                    getCssVar("--scope-plot-1", "#ff6b6b"),
                    getCssVar("--scope-plot-2", "#ff9f43"),
                    getCssVar("--scope-plot-3", "#ff78f2"),
                    getCssVar("--scope-plot-4", "#b084ff"),
                    getCssVar("--scope-plot-5", "#6ea8ff"),
                    getCssVar("--scope-plot-6", "#56d4ff"),
                    getCssVar("--scope-plot-7", "#fff36b"),
                    getCssVar("--scope-plot-8", "#8ef7c6")
            };
        }
        return scopePlotPalette[index % scopePlotPalette.length];
    }

    public static Color canvasBgColor() {
        return new Color(canvasBg());
    }

    public static Color scopeBgColor() {
        return new Color(scopeBg());
    }

    private static native String readCssVar(String name) /*-{
        var style = $wnd.getComputedStyle($doc.documentElement);
        var value = style ? style.getPropertyValue(name) : null;
        return value ? value.trim() : null;
    }-*/;

    private static String getCssVar(String name, String fallback) {
        String value = readCssVar(name);
        return (value == null || value.length() == 0) ? fallback : value;
    }
}
