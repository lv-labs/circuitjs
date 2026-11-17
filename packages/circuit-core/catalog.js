'use strict';
// Portable computation module: no DOM, renderer, storage or worker construction.
(() => {
  const registry=globalThis.CircuitCoreModules ||= {};
  // BEGIN GENERATED SYMBOL CATALOG
  const outputSpecs = {
    "variableVoltage": {
      "name": "Variable voltage",
      "prefix": "V",
      "drawingScale": 3.125,
      "pins": {
        "p": [
          0,
          100
        ]
      },
      "type": "172",
      "fields": {
        "minVoltage": {
          "label": "Minimum voltage · V",
          "type": "number",
          "default": 0
        },
        "maxVoltage": {
          "label": "Maximum voltage · V",
          "type": "number",
          "default": 5
        },
        "voltage": {
          "label": "Voltage · V",
          "type": "number",
          "default": 2.5
        },
        "label": {
          "label": "Slider label",
          "type": "string",
          "maxLength": 80,
          "default": "Voltage"
        }
      },
      "parameters": {
        "minVoltage": 0,
        "maxVoltage": 5,
        "voltage": 2.5,
        "label": "Voltage"
      },
      "sign": -1
    },
    "lamp": {
      "name": "Lamp",
      "prefix": "LP",
      "drawingScale": 3.125,
      "pins": {
        "a": [
          -150,
          0
        ],
        "b": [
          150,
          0
        ]
      },
      "type": "181",
      "fields": {
        "nominalPower": {
          "label": "Nominal power · W",
          "type": "number",
          "exclusiveMin": 0,
          "default": 100
        },
        "nominalVoltage": {
          "label": "Nominal voltage · V",
          "type": "number",
          "exclusiveMin": 0,
          "default": 120
        },
        "warmTime": {
          "label": "Warm-up time · s",
          "type": "number",
          "exclusiveMin": 0,
          "default": 0.4
        },
        "coolTime": {
          "label": "Cool-down time · s",
          "type": "number",
          "exclusiveMin": 0,
          "default": 0.4
        },
        "initialTemperature": {
          "label": "Initial temperature · K",
          "type": "number",
          "min": 300,
          "max": 5000,
          "default": 300
        }
      },
      "parameters": {
        "nominalPower": 100,
        "nominalVoltage": 120,
        "warmTime": 0.4,
        "coolTime": 0.4,
        "initialTemperature": 300
      },
      "sign": 1
    },
    "text": {
      "name": "Text",
      "prefix": "TXT",
      "drawingScale": 1,
      "pins": {},
      "type": "x",
      "fields": {
        "text": {
          "label": "Text",
          "type": "string",
          "maxLength": 4096,
          "default": "Text"
        },
        "drawBar": {
          "label": "Draw bar on top",
          "type": "boolean",
          "optional": true,
          "default": false
        },
        "size": {
          "label": "Font size",
          "type": "number",
          "min": 8,
          "max": 300,
          "default": 56.25
        }
      },
      "parameters": {
        "text": "Text",
        "size": 56.25,
        "drawBar": false
      },
      "sign": null
    },
    "box": {
      "name": "Box",
      "prefix": "BOX",
      "drawingScale": 1,
      "pins": {},
      "type": "b",
      "fields": {
        "width": {
          "label": "Width · canvas units",
          "type": "number",
          "min": 16,
          "max": 2048,
          "default": 400
        },
        "height": {
          "label": "Height · canvas units",
          "type": "number",
          "min": 16,
          "max": 2048,
          "default": 300
        }
      },
      "parameters": {
        "width": 400,
        "height": 300
      },
      "sign": null
    },
    "line": {
      "name": "Line",
      "prefix": "LINE",
      "drawingScale": 1,
      "pins": {},
      "type": "423",
      "fields": {
        "width": {
          "label": "Width · canvas units",
          "type": "number",
          "min": 16,
          "max": 2048,
          "default": 400
        },
        "height": {
          "label": "Height · canvas units",
          "type": "number",
          "min": 0,
          "max": 2048,
          "default": 0
        }
      },
      "parameters": {
        "width": 400,
        "height": 0
      },
      "sign": null
    },
    "labeledNode": {
      "name": "Labeled node",
      "prefix": "NET",
      "drawingScale": 3.125,
      "pins": {
        "in": [
          -150,
          0
        ]
      },
      "type": "207",
      "fields": {
        "name": {
          "label": "Net name",
          "type": "string",
          "maxLength": 80,
          "default": "NET"
        }
      },
      "parameters": {
        "name": "NET"
      },
      "sign": null
    },
    "voltmeter": {
      "name": "Voltmeter / scope probe",
      "prefix": "VM",
      "drawingScale": 1,
      "pins": {
        "a": [
          -100,
          0
        ],
        "b": [
          100,
          0
        ]
      },
      "type": "p",
      "fields": {
        "mode": {
          "label": "Reading (0 V, 1 RMS, 2 max, 3 min, 4 peak-to-peak, 5 binary)",
          "type": "number",
          "min": 0,
          "max": 5,
          "integer": true,
          "default": 0
        },
        "resistance": {
          "label": "Input resistance · Ω (0 = ideal)",
          "type": "number",
          "min": 0,
          "default": 10000000
        }
      },
      "parameters": {
        "mode": 0,
        "resistance": 10000000
      },
      "sign": 1
    },
    "ohmmeter": {
      "name": "Ohmmeter",
      "prefix": "OM",
      "drawingScale": 1,
      "pins": {
        "a": [
          -100,
          0
        ],
        "b": [
          100,
          0
        ]
      },
      "type": "216",
      "fields": {
        "current": {
          "label": "Test current a → b · A",
          "type": "number",
          "min": 0,
          "max": 1,
          "default": 0.01
        },
        "maxVoltage": {
          "label": "Compliance voltage · V (0 = ideal)",
          "type": "number",
          "min": 0,
          "default": 0
        }
      },
      "parameters": {
        "current": 0.01,
        "maxVoltage": 0
      },
      "sign": 1
    },
    "ammeter": {
      "name": "Ammeter",
      "prefix": "AM",
      "drawingScale": 1,
      "pins": {
        "a": [
          -100,
          0
        ],
        "b": [
          100,
          0
        ]
      },
      "type": "370",
      "fields": {
        "mode": {
          "label": "Reading (0 instantaneous, 1 RMS)",
          "type": "number",
          "min": 0,
          "max": 1,
          "integer": true,
          "default": 0
        }
      },
      "parameters": {
        "mode": 0
      },
      "sign": 1
    },
    "wattmeter": {
      "name": "Wattmeter",
      "prefix": "WM",
      "drawingScale": 1,
      "pins": {
        "returnIn": [
          -100,
          50
        ],
        "returnOut": [
          100,
          50
        ],
        "currentIn": [
          -100,
          -50
        ],
        "currentOut": [
          100,
          -50
        ]
      },
      "type": "420",
      "fields": {
        "mode": {
          "label": "Reading (0 instantaneous, 1 average)",
          "type": "number",
          "min": 0,
          "max": 1,
          "integer": true,
          "default": 0
        }
      },
      "parameters": {
        "mode": 0
      },
      "sign": null
    },
    "testPoint": {
      "name": "Test point",
      "prefix": "TP",
      "drawingScale": 3.125,
      "pins": {
        "in": [
          -150,
          0
        ]
      },
      "type": "368",
      "fields": {
        "mode": {
          "label": "Reading (0 V, 1 RMS, 2 max, 3 min, 4 peak-to-peak, 5 binary)",
          "type": "number",
          "min": 0,
          "max": 5,
          "integer": true,
          "default": 0
        },
        "label": {
          "label": "Label",
          "type": "string",
          "maxLength": 80,
          "default": "TP"
        }
      },
      "parameters": {
        "mode": 0,
        "label": "TP"
      },
      "sign": null
    },
    "decimalDisplay": {
      "name": "Decimal display (4 bit)",
      "prefix": "DISP",
      "drawingScale": 3.125,
      "pins": {
        "I0": [
          -150,
          150
        ],
        "I1": [
          -150,
          50
        ],
        "I2": [
          -150,
          -50
        ],
        "I3": [
          -150,
          -150
        ]
      },
      "type": "419",
      "fields": {
        "mode": {
          "label": "Base (0 decimal, 1 hex, 2 octal)",
          "type": "number",
          "min": 0,
          "max": 2,
          "integer": true,
          "default": 0
        }
      },
      "parameters": {
        "mode": 0
      },
      "sign": null
    },
    "instructionDisplay": {
      "name": "Instruction display (4 bit)",
      "prefix": "INS",
      "drawingScale": 3.125,
      "pins": {
        "I0": [
          -150,
          150
        ],
        "I1": [
          -150,
          50
        ],
        "I2": [
          -150,
          -50
        ],
        "I3": [
          -150,
          -150
        ]
      },
      "type": "instruction",
      "fields": {
        "threshold": {
          "label": "Logic threshold · V",
          "type": "number",
          "default": 2.5
        },
        "lookup": {
          "label": "Lookup table (one value or range = text per line)",
          "type": "string",
          "maxLength": 4096,
          "default": "0=NOP\n1=LOAD\n2-15=OP {a}"
        }
      },
      "parameters": {
        "threshold": 2.5,
        "lookup": "0=NOP\n1=LOAD\n2-15=OP {a}"
      },
      "sign": null
    },
    "ledArray": {
      "name": "LED array (8 × 8)",
      "prefix": "LA",
      "drawingScale": 3.125,
      "pins": {
        "C0": [
          -350,
          500
        ],
        "C1": [
          -250,
          500
        ],
        "C2": [
          -150,
          500
        ],
        "C3": [
          -50,
          500
        ],
        "C4": [
          50,
          500
        ],
        "C5": [
          150,
          500
        ],
        "C6": [
          250,
          500
        ],
        "C7": [
          350,
          500
        ],
        "R0": [
          -500,
          -350
        ],
        "R1": [
          -500,
          -250
        ],
        "R2": [
          -500,
          -150
        ],
        "R3": [
          -500,
          -50
        ],
        "R4": [
          -500,
          50
        ],
        "R5": [
          -500,
          150
        ],
        "R6": [
          -500,
          250
        ],
        "R7": [
          -500,
          350
        ]
      },
      "type": "405",
      "fields": {},
      "parameters": {},
      "sign": null
    },
    "dataExport": {
      "name": "Data export",
      "prefix": "DATA",
      "drawingScale": 3.125,
      "pins": {
        "in": [
          -150,
          0
        ]
      },
      "type": "210",
      "fields": {
        "capacity": {
          "label": "Maximum data points",
          "type": "number",
          "min": 1,
          "max": 100000,
          "integer": true,
          "default": 10240
        }
      },
      "parameters": {
        "capacity": 10240
      },
      "sign": null
    },
    "audioOutput": {
      "name": "Audio output",
      "prefix": "AUDIO",
      "drawingScale": 3.125,
      "pins": {
        "in": [
          -150,
          0
        ]
      },
      "type": "211",
      "fields": {
        "duration": {
          "label": "Capture duration · s",
          "type": "number",
          "min": 0.001,
          "max": 10,
          "default": 1
        },
        "sampleRate": {
          "label": "Sample rate · Hz",
          "type": "number",
          "choices": [
            8000,
            11025,
            16000,
            22050,
            44100,
            48000
          ],
          "default": 8000
        }
      },
      "parameters": {
        "duration": 1,
        "sampleRate": 8000
      },
      "sign": null
    },
    "stopTrigger": {
      "name": "Stop trigger",
      "prefix": "TRIG",
      "drawingScale": 3.125,
      "pins": {
        "in": [
          -150,
          0
        ]
      },
      "type": "408",
      "fields": {
        "threshold": {
          "label": "Trigger voltage · V",
          "type": "number",
          "default": 1
        },
        "direction": {
          "label": "Condition (0 ≥ threshold, 1 ≤ threshold)",
          "type": "number",
          "min": 0,
          "max": 1,
          "integer": true,
          "default": 0
        },
        "delay": {
          "label": "Delay · s",
          "type": "number",
          "min": 0,
          "default": 0
        }
      },
      "parameters": {
        "threshold": 1,
        "direction": 0,
        "delay": 0
      },
      "sign": null
    },
    "dcMotor": {
      "name": "DC motor",
      "prefix": "M",
      "drawingScale": 3.125,
      "pins": {
        "a": [
          -150,
          0
        ],
        "b": [
          150,
          0
        ]
      },
      "type": "415",
      "fields": {
        "inductance": {
          "label": "Armature inductance · H",
          "type": "number",
          "exclusiveMin": 0,
          "default": 0.5
        },
        "resistance": {
          "label": "Armature resistance · Ω",
          "type": "number",
          "exclusiveMin": 0,
          "default": 1
        },
        "torqueConstant": {
          "label": "Torque constant",
          "type": "number",
          "min": 0,
          "default": 0.15
        },
        "backEmfConstant": {
          "label": "Back EMF constant",
          "type": "number",
          "min": 0,
          "default": 0.15
        },
        "inertia": {
          "label": "Rotor inertia",
          "type": "number",
          "exclusiveMin": 0,
          "default": 0.02
        },
        "friction": {
          "label": "Friction coefficient",
          "type": "number",
          "exclusiveMin": 0,
          "default": 0.05
        },
        "gearRatio": {
          "label": "Gear ratio",
          "type": "number",
          "exclusiveMin": 0,
          "default": 1
        },
        "loadTorque": {
          "label": "Load torque",
          "type": "number",
          "default": 0
        }
      },
      "parameters": {
        "inductance": 0.5,
        "resistance": 1,
        "torqueConstant": 0.15,
        "backEmfConstant": 0.15,
        "inertia": 0.02,
        "friction": 0.05,
        "gearRatio": 1,
        "loadTorque": 0
      },
      "sign": 1
    },
    "threePhaseMotor": {
      "name": "3-phase motor",
      "prefix": "M",
      "drawingScale": 3.125,
      "pins": {
        "U1": [
          -150,
          -100
        ],
        "U2": [
          150,
          100
        ],
        "V1": [
          -150,
          0
        ],
        "V2": [
          150,
          0
        ],
        "W1": [
          -150,
          100
        ],
        "W2": [
          150,
          -100
        ]
      },
      "type": "427",
      "fields": {
        "statorResistance": {
          "label": "Stator resistance · Ω",
          "type": "number",
          "exclusiveMin": 0,
          "default": 0.435
        },
        "rotorResistance": {
          "label": "Rotor resistance · Ω",
          "type": "number",
          "exclusiveMin": 0,
          "default": 0.816
        },
        "statorInductance": {
          "label": "Stator inductance · H",
          "type": "number",
          "exclusiveMin": 0,
          "default": 0.0294
        },
        "rotorInductance": {
          "label": "Rotor inductance · H",
          "type": "number",
          "exclusiveMin": 0,
          "default": 0.0297
        },
        "mutualInductance": {
          "label": "Mutual inductance · H",
          "type": "number",
          "exclusiveMin": 0,
          "default": 0.0287
        },
        "friction": {
          "label": "Friction coefficient",
          "type": "number",
          "min": 0,
          "default": 0.05
        },
        "inertia": {
          "label": "Rotor inertia",
          "type": "number",
          "exclusiveMin": 0,
          "default": 1
        }
      },
      "parameters": {
        "statorResistance": 0.435,
        "rotorResistance": 0.816,
        "statorInductance": 0.0294,
        "rotorInductance": 0.0297,
        "mutualInductance": 0.0287,
        "friction": 0.05,
        "inertia": 1
      },
      "sign": null
    },
    "sweepSource": {
      "name": "A/C sweep",
      "prefix": "V",
      "drawingScale": 3.125,
      "pins": {
        "p": [
          0,
          100
        ]
      },
      "type": "170",
      "fields": {
        "minFrequency": {
          "label": "Minimum frequency · Hz",
          "type": "number",
          "exclusiveMin": 0,
          "default": 20
        },
        "maxFrequency": {
          "label": "Maximum frequency · Hz",
          "type": "number",
          "min": 0,
          "default": 4000
        },
        "amplitude": {
          "label": "Peak voltage · V",
          "type": "number",
          "min": 0,
          "default": 5
        },
        "sweepTime": {
          "label": "Sweep time · s",
          "type": "number",
          "exclusiveMin": 0,
          "default": 0.1
        },
        "logarithmic": {
          "label": "Logarithmic sweep",
          "type": "boolean",
          "default": false
        },
        "bidirectional": {
          "label": "Sweep up and down",
          "type": "boolean",
          "default": true
        }
      },
      "parameters": {
        "minFrequency": 20,
        "maxFrequency": 4000,
        "amplitude": 5,
        "sweepTime": 0.1,
        "logarithmic": false,
        "bidirectional": true
      },
      "sign": -1
    },
    "antennaSource": {
      "name": "Antenna",
      "prefix": "V",
      "drawingScale": 3.125,
      "pins": {
        "p": [
          0,
          100
        ]
      },
      "type": "A",
      "fields": {},
      "parameters": {},
      "sign": -1
    },
    "amSource": {
      "name": "AM source",
      "prefix": "V",
      "drawingScale": 3.125,
      "pins": {
        "p": [
          0,
          100
        ]
      },
      "type": "200",
      "fields": {
        "carrierFrequency": {
          "label": "Carrier frequency · Hz",
          "type": "number",
          "min": 0,
          "default": 1000
        },
        "signalFrequency": {
          "label": "Signal frequency · Hz",
          "type": "number",
          "min": 0,
          "default": 40
        },
        "amplitude": {
          "label": "Peak voltage · V",
          "type": "number",
          "min": 0,
          "default": 5
        }
      },
      "parameters": {
        "carrierFrequency": 1000,
        "signalFrequency": 40,
        "amplitude": 5
      },
      "sign": -1
    },
    "fmSource": {
      "name": "FM source",
      "prefix": "V",
      "drawingScale": 3.125,
      "pins": {
        "p": [
          0,
          100
        ]
      },
      "type": "201",
      "fields": {
        "carrierFrequency": {
          "label": "Carrier frequency · Hz",
          "type": "number",
          "min": 0,
          "default": 800
        },
        "signalFrequency": {
          "label": "Signal frequency · Hz",
          "type": "number",
          "min": 0,
          "default": 40
        },
        "amplitude": {
          "label": "Peak voltage · V",
          "type": "number",
          "min": 0,
          "default": 5
        },
        "deviation": {
          "label": "Frequency deviation · Hz",
          "type": "number",
          "min": 0,
          "default": 200
        }
      },
      "parameters": {
        "carrierFrequency": 800,
        "signalFrequency": 40,
        "amplitude": 5,
        "deviation": 200
      },
      "sign": -1
    },
    "noiseSource": {
      "name": "Noise source",
      "prefix": "V",
      "drawingScale": 3.125,
      "pins": {
        "p": [
          0,
          100
        ]
      },
      "type": "R",
      "fields": {
        "amplitude": {
          "label": "Peak voltage · V",
          "type": "number",
          "min": 0,
          "default": 5
        },
        "offset": {
          "label": "DC offset · V",
          "type": "number",
          "default": 0
        }
      },
      "parameters": {
        "amplitude": 5,
        "offset": 0
      },
      "sign": -1
    },
    "schmittTrigger": {
      "name": "Schmitt trigger",
      "prefix": "U",
      "drawingScale": 3.125,
      "pins": {
        "input": [
          -150,
          0
        ],
        "out": [
          150,
          0
        ]
      },
      "type": "182",
      "fields": {
        "slewRate": {
          "label": "Slew rate · V/ns",
          "type": "number",
          "exclusiveMin": 0,
          "default": 0.5
        },
        "lowerThreshold": {
          "label": "Lower threshold · V",
          "type": "number",
          "default": 1.66
        },
        "upperThreshold": {
          "label": "Upper threshold · V",
          "type": "number",
          "default": 3.33
        },
        "highVoltage": {
          "label": "High output · V",
          "type": "number",
          "default": 5
        },
        "lowVoltage": {
          "label": "Low output · V",
          "type": "number",
          "default": 0
        }
      },
      "parameters": {
        "slewRate": 0.5,
        "lowerThreshold": 1.66,
        "upperThreshold": 3.33,
        "highVoltage": 5,
        "lowVoltage": 0
      },
      "sign": -1
    },
    "invertingSchmittTrigger": {
      "name": "Inverting Schmitt trigger",
      "prefix": "U",
      "drawingScale": 3.125,
      "pins": {
        "input": [
          -150,
          0
        ],
        "out": [
          150,
          0
        ]
      },
      "type": "183",
      "fields": {
        "slewRate": {
          "label": "Slew rate · V/ns",
          "type": "number",
          "exclusiveMin": 0,
          "default": 0.5
        },
        "lowerThreshold": {
          "label": "Lower threshold · V",
          "type": "number",
          "default": 1.66
        },
        "upperThreshold": {
          "label": "Upper threshold · V",
          "type": "number",
          "default": 3.33
        },
        "highVoltage": {
          "label": "High output · V",
          "type": "number",
          "default": 5
        },
        "lowVoltage": {
          "label": "Low output · V",
          "type": "number",
          "default": 0
        }
      },
      "parameters": {
        "slewRate": 0.5,
        "lowerThreshold": 1.66,
        "upperThreshold": 3.33,
        "highVoltage": 5,
        "lowVoltage": 0
      },
      "sign": -1
    },
    "sparkGap": {
      "name": "Spark gap",
      "prefix": "R",
      "drawingScale": 3.125,
      "pins": {
        "a": [
          -150,
          0
        ],
        "b": [
          150,
          0
        ]
      },
      "type": "187",
      "fields": {
        "onResistance": {
          "label": "On resistance · Ω",
          "type": "number",
          "exclusiveMin": 0,
          "default": 1000
        },
        "offResistance": {
          "label": "Off resistance · Ω",
          "type": "number",
          "exclusiveMin": 0,
          "default": 1000000000
        },
        "breakdownVoltage": {
          "label": "Breakdown voltage · V",
          "type": "number",
          "exclusiveMin": 0,
          "default": 1000
        },
        "holdingCurrent": {
          "label": "Holding current · A",
          "type": "number",
          "min": 0,
          "default": 0.001
        }
      },
      "parameters": {
        "onResistance": 1000,
        "offResistance": 1000000000,
        "breakdownVoltage": 1000,
        "holdingCurrent": 0.001
      },
      "sign": 1
    },
    "memristor": {
      "name": "Memristor",
      "prefix": "R",
      "drawingScale": 3.125,
      "pins": {
        "a": [
          -150,
          0
        ],
        "b": [
          150,
          0
        ]
      },
      "type": "m",
      "fields": {
        "onResistance": {
          "label": "On resistance · Ω",
          "type": "number",
          "exclusiveMin": 0,
          "default": 100
        },
        "offResistance": {
          "label": "Off resistance · Ω",
          "type": "number",
          "exclusiveMin": 0,
          "default": 16000
        },
        "initialDopedWidth": {
          "label": "Initial doped width · m",
          "type": "number",
          "min": 0,
          "default": 0
        },
        "totalWidth": {
          "label": "Total width · m",
          "type": "number",
          "exclusiveMin": 0,
          "default": 1e-8
        },
        "mobility": {
          "label": "Ion mobility · m²/(V·s)",
          "type": "number",
          "min": 0,
          "default": 1e-10
        }
      },
      "parameters": {
        "onResistance": 100,
        "offResistance": 16000,
        "initialDopedWidth": 0,
        "totalWidth": 1e-8,
        "mobility": 1e-10
      },
      "sign": 1
    },
    "tunnelDiode": {
      "name": "Tunnel diode",
      "prefix": "D",
      "drawingScale": 3.125,
      "pins": {
        "anode": [
          -150,
          0
        ],
        "cathode": [
          150,
          0
        ]
      },
      "type": "175",
      "fields": {},
      "parameters": {},
      "sign": 1
    },
    "fuse": {
      "name": "Fuse",
      "prefix": "R",
      "drawingScale": 3.125,
      "pins": {
        "a": [
          -150,
          0
        ],
        "b": [
          150,
          0
        ]
      },
      "type": "404",
      "fields": {
        "resistance": {
          "label": "Cold resistance · Ω",
          "type": "number",
          "exclusiveMin": 0,
          "default": 0.0613
        },
        "i2t": {
          "label": "Melting I²t · A²s",
          "type": "number",
          "exclusiveMin": 0,
          "default": 6.73
        }
      },
      "parameters": {
        "resistance": 0.0613,
        "i2t": 6.73
      },
      "sign": 1
    },
    "photoresistor": {
      "name": "Photoresistor",
      "prefix": "R",
      "drawingScale": 3.125,
      "pins": {
        "a": [
          -150,
          0
        ],
        "b": [
          150,
          0
        ]
      },
      "type": "374",
      "fields": {
        "position": {
          "label": "Sensor position · 0 to 1",
          "type": "number",
          "min": 0,
          "max": 1,
          "default": 0.34
        }
      },
      "parameters": {
        "position": 0.34
      },
      "sign": 1
    },
    "thermistor": {
      "name": "NTC thermistor",
      "prefix": "R",
      "drawingScale": 3.125,
      "pins": {
        "a": [
          -150,
          0
        ],
        "b": [
          150,
          0
        ]
      },
      "type": "350",
      "fields": {
        "resistance25": {
          "label": "Resistance at 25 °C · Ω",
          "type": "number",
          "exclusiveMin": 0,
          "default": 10000
        },
        "resistance50": {
          "label": "Resistance at 50 °C · Ω",
          "type": "number",
          "exclusiveMin": 0,
          "default": 3605
        },
        "minTemperature": {
          "label": "Minimum temperature · °C",
          "type": "number",
          "exclusiveMin": -273.15,
          "default": -40
        },
        "maxTemperature": {
          "label": "Maximum temperature · °C",
          "type": "number",
          "exclusiveMin": -273.15,
          "default": 150
        },
        "position": {
          "label": "Sensor position · 0 to 1",
          "type": "number",
          "min": 0,
          "max": 1,
          "default": 0.34
        }
      },
      "parameters": {
        "resistance25": 10000,
        "resistance50": 3605,
        "minTemperature": -40,
        "maxTemperature": 150,
        "position": 0.34
      },
      "sign": 1
    },
    "scr": {
      "name": "SCR",
      "prefix": "D",
      "drawingScale": 3.125,
      "pins": {
        "anode": [
          -150,
          0
        ],
        "cathode": [
          150,
          0
        ],
        "gate": [
          50,
          100
        ]
      },
      "type": "177",
      "fields": {
        "triggerCurrent": {
          "label": "Trigger current · A",
          "type": "number",
          "exclusiveMin": 0,
          "default": 0.01
        },
        "holdingCurrent": {
          "label": "Holding current · A",
          "type": "number",
          "exclusiveMin": 0,
          "default": 0.0082
        },
        "gateResistance": {
          "label": "Gate resistance · Ω",
          "type": "number",
          "exclusiveMin": 0,
          "default": 50
        }
      },
      "parameters": {
        "triggerCurrent": 0.01,
        "holdingCurrent": 0.0082,
        "gateResistance": 50
      },
      "sign": null
    },
    "diac": {
      "name": "DIAC",
      "prefix": "D",
      "drawingScale": 3.125,
      "pins": {
        "a": [
          -150,
          0
        ],
        "b": [
          150,
          0
        ]
      },
      "type": "203",
      "fields": {
        "onResistance": {
          "label": "On resistance · Ω",
          "type": "number",
          "exclusiveMin": 0,
          "default": 500
        },
        "offResistance": {
          "label": "Off resistance · Ω",
          "type": "number",
          "exclusiveMin": 0,
          "default": 100000000
        },
        "breakdownVoltage": {
          "label": "Breakdown voltage · V",
          "type": "number",
          "exclusiveMin": 0,
          "default": 30
        },
        "holdingCurrent": {
          "label": "Holding current · A",
          "type": "number",
          "min": 0,
          "default": 0.01
        }
      },
      "parameters": {
        "onResistance": 500,
        "offResistance": 100000000,
        "breakdownVoltage": 30,
        "holdingCurrent": 0.01
      },
      "sign": 1
    },
    "triac": {
      "name": "TRIAC",
      "prefix": "D",
      "drawingScale": 3.125,
      "pins": {
        "mt2": [
          -150,
          0
        ],
        "mt1": [
          150,
          0
        ],
        "gate": [
          50,
          100
        ]
      },
      "type": "206",
      "fields": {
        "triggerCurrent": {
          "label": "Trigger current · A",
          "type": "number",
          "exclusiveMin": 0,
          "default": 0.01
        },
        "holdingCurrent": {
          "label": "Holding current · A",
          "type": "number",
          "exclusiveMin": 0,
          "default": 0.0082
        },
        "gateResistance": {
          "label": "Gate resistance · Ω",
          "type": "number",
          "exclusiveMin": 0,
          "default": 100
        }
      },
      "parameters": {
        "triggerCurrent": 0.01,
        "holdingCurrent": 0.0082,
        "gateResistance": 100
      },
      "sign": 1
    },
    "varactor": {
      "name": "Varactor",
      "prefix": "D",
      "drawingScale": 3.125,
      "pins": {
        "anode": [
          -150,
          0
        ],
        "cathode": [
          150,
          0
        ]
      },
      "type": "176",
      "fields": {
        "capacitance": {
          "label": "Zero-bias capacitance · F",
          "type": "number",
          "exclusiveMin": 0,
          "default": 4e-12
        }
      },
      "parameters": {
        "capacitance": 4e-12
      },
      "sign": 1
    },
    "triode": {
      "name": "Triode",
      "prefix": "Q",
      "drawingScale": 3.125,
      "pins": {
        "plate": [
          100,
          -150
        ],
        "grid": [
          -150,
          0
        ],
        "cathode": [
          100,
          150
        ]
      },
      "type": "173",
      "fields": {
        "mu": {
          "label": "Amplification factor · μ",
          "type": "number",
          "exclusiveMin": 0,
          "default": 93
        },
        "kg1": {
          "label": "Triode perveance factor · kg1",
          "type": "number",
          "exclusiveMin": 0,
          "default": 680
        }
      },
      "parameters": {
        "mu": 93,
        "kg1": 680
      },
      "sign": 1
    }
  };
  const basicDefinitions = {
    "npn": {
      "drawingScale": 3.125,
      "prefix": "Q",
      "name": "NPN transistor",
      "pins": {
        "base": [
          -150,
          0
        ],
        "collector": [
          150,
          -50
        ],
        "emitter": [
          150,
          50
        ]
      },
      "parameters": {
        "beta": 100,
        "model": "default",
        "swapTerminals": false,
        "drawCircle": false
      }
    },
    "pnp": {
      "drawingScale": 3.125,
      "prefix": "Q",
      "name": "PNP transistor",
      "pins": {
        "base": [
          -150,
          0
        ],
        "collector": [
          150,
          50
        ],
        "emitter": [
          150,
          -50
        ]
      },
      "parameters": {
        "beta": 100,
        "model": "default",
        "swapTerminals": false,
        "drawCircle": false
      }
    },
    "nmos": {
      "drawingScale": 3.125,
      "prefix": "Q",
      "name": "NMOS",
      "pins": {
        "gate": [
          -150,
          0
        ],
        "source": [
          150,
          50
        ],
        "drain": [
          150,
          -50
        ]
      },
      "parameters": {
        "threshold": 1.5,
        "beta": 0.02,
        "bodyDiode": true,
        "bodyTerminal": false,
        "showBulk": true,
        "digitalSymbol": false,
        "showBodyDiode": false,
        "swapTerminals": false
      }
    },
    "pmos": {
      "drawingScale": 3.125,
      "prefix": "Q",
      "name": "PMOS",
      "pins": {
        "gate": [
          -150,
          0
        ],
        "source": [
          150,
          50
        ],
        "drain": [
          150,
          -50
        ]
      },
      "parameters": {
        "threshold": 1.5,
        "beta": 0.02,
        "bodyDiode": true,
        "bodyTerminal": false,
        "showBulk": true,
        "digitalSymbol": false,
        "showBodyDiode": false,
        "swapTerminals": false
      }
    },
    "njfet": {
      "drawingScale": 3.125,
      "prefix": "Q",
      "name": "NJFET",
      "pins": {
        "gate": [
          -150,
          0
        ],
        "source": [
          150,
          50
        ],
        "drain": [
          150,
          -50
        ]
      },
      "parameters": {
        "threshold": -4,
        "beta": 0.00125
      }
    },
    "pjfet": {
      "drawingScale": 3.125,
      "prefix": "Q",
      "name": "PJFET",
      "pins": {
        "gate": [
          -150,
          0
        ],
        "source": [
          150,
          50
        ],
        "drain": [
          150,
          -50
        ]
      },
      "parameters": {
        "threshold": -4,
        "beta": 0.00125
      }
    },
    "andGate": {
      "drawingScale": 3.125,
      "prefix": "U",
      "name": "AND gate",
      "pins": {
        "a": [
          -150,
          -50
        ],
        "b": [
          -150,
          50
        ],
        "out": [
          150,
          0
        ]
      },
      "parameters": {
        "highVoltage": 5,
        "inputCount": 2,
        "propagationDelay": 0,
        "schmittInputs": false,
        "invertInputs": false
      }
    },
    "nandGate": {
      "drawingScale": 3.125,
      "prefix": "U",
      "name": "NAND gate",
      "pins": {
        "a": [
          -150,
          -50
        ],
        "b": [
          -150,
          50
        ],
        "out": [
          150,
          0
        ]
      },
      "parameters": {
        "highVoltage": 5,
        "inputCount": 2,
        "propagationDelay": 0,
        "schmittInputs": false,
        "invertInputs": false
      }
    },
    "orGate": {
      "drawingScale": 3.125,
      "prefix": "U",
      "name": "OR gate",
      "pins": {
        "a": [
          -150,
          -50
        ],
        "b": [
          -150,
          50
        ],
        "out": [
          150,
          0
        ]
      },
      "parameters": {
        "highVoltage": 5,
        "inputCount": 2,
        "propagationDelay": 0,
        "schmittInputs": false,
        "invertInputs": false
      }
    },
    "norGate": {
      "drawingScale": 3.125,
      "prefix": "U",
      "name": "NOR gate",
      "pins": {
        "a": [
          -150,
          -50
        ],
        "b": [
          -150,
          50
        ],
        "out": [
          150,
          0
        ]
      },
      "parameters": {
        "highVoltage": 5,
        "inputCount": 2,
        "propagationDelay": 0,
        "schmittInputs": false,
        "invertInputs": false
      }
    },
    "xorGate": {
      "drawingScale": 3.125,
      "prefix": "U",
      "name": "XOR gate",
      "pins": {
        "a": [
          -150,
          -50
        ],
        "b": [
          -150,
          50
        ],
        "out": [
          150,
          0
        ]
      },
      "parameters": {
        "highVoltage": 5,
        "inputCount": 2,
        "propagationDelay": 0,
        "schmittInputs": false,
        "invertInputs": false
      }
    },
    "inverter": {
      "drawingScale": 3.125,
      "prefix": "U",
      "name": "Inverter",
      "pins": {
        "input": [
          -150,
          0
        ],
        "out": [
          150,
          0
        ]
      },
      "parameters": {
        "highVoltage": 5,
        "slewRate": 0.5
      }
    },
    "transformer": {
      "drawingScale": 3.125,
      "prefix": "T",
      "name": "Transformer",
      "pins": {
        "p1": [
          -100,
          -150
        ],
        "s1": [
          100,
          -150
        ],
        "p2": [
          -100,
          150
        ],
        "s2": [
          100,
          150
        ]
      },
      "parameters": {
        "inductance": 4,
        "ratio": 1,
        "coupling": 0.999,
        "integration": "backwardEuler"
      }
    },
    "spdtSwitch": {
      "drawingScale": 3.125,
      "prefix": "S",
      "name": "SPDT switch",
      "pins": {
        "common": [
          -150,
          0
        ],
        "a": [
          150,
          -50
        ],
        "b": [
          150,
          50
        ]
      },
      "parameters": {
        "onResistance": 0,
        "momentary": false,
        "linkLabel": "",
        "iecSymbol": false,
        "group": 0,
        "throwCount": 2,
        "centerOff": false,
        "position": 0
      }
    },
    "dpdtSwitch": {
      "drawingScale": 3.125,
      "prefix": "S",
      "name": "DPDT switch",
      "pins": {
        "common1": [
          -150,
          -100
        ],
        "a1": [
          150,
          -50
        ],
        "b1": [
          150,
          -150
        ],
        "common2": [
          -150,
          50
        ],
        "a2": [
          150,
          100
        ],
        "b2": [
          150,
          0
        ]
      },
      "parameters": {
        "onResistance": 0,
        "momentary": false,
        "linkLabel": "",
        "iecSymbol": false,
        "poleCount": 2,
        "position": 0
      }
    },
    "led": {
      "prefix": "D",
      "name": "LED",
      "pins": {
        "anode": [
          -100,
          0
        ],
        "cathode": [
          100,
          0
        ]
      },
      "parameters": {
        "model": "default-led",
        "red": 1,
        "green": 0,
        "blue": 0,
        "maxCurrent": 0.01
      }
    },
    "zener": {
      "drawingScale": 3.125,
      "prefix": "D",
      "name": "Zener diode",
      "pins": {
        "anode": [
          -150,
          0
        ],
        "cathode": [
          150,
          0
        ]
      },
      "parameters": {
        "model": "default-zener"
      }
    },
    "resistor": {
      "prefix": "R",
      "name": "Resistor",
      "pins": {
        "a": [
          0,
          -100
        ],
        "b": [
          0,
          100
        ]
      },
      "parameters": {
        "resistance": 1000
      }
    },
    "inductor": {
      "drawingScale": 3.125,
      "prefix": "L",
      "name": "Inductor",
      "pins": {
        "a": [
          -150,
          0
        ],
        "b": [
          150,
          0
        ]
      },
      "parameters": {
        "inductance": 1,
        "initialCurrent": 0,
        "integration": "backwardEuler"
      }
    },
    "diode": {
      "drawingScale": 3.125,
      "prefix": "D",
      "name": "Diode",
      "pins": {
        "anode": [
          -150,
          0
        ],
        "cathode": [
          150,
          0
        ]
      },
      "parameters": {
        "model": "default"
      }
    },
    "currentSource": {
      "drawingScale": 3.125,
      "prefix": "I",
      "name": "DC current source",
      "pins": {
        "a": [
          -150,
          0
        ],
        "b": [
          150,
          0
        ]
      },
      "parameters": {
        "current": 0.01,
        "maxVoltage": 0
      }
    },
    "potentiometer": {
      "drawingScale": 3.125,
      "prefix": "RV",
      "name": "Potentiometer",
      "pins": {
        "a": [
          -150,
          0
        ],
        "b": [
          150,
          0
        ],
        "wiper": [
          0,
          100
        ]
      },
      "parameters": {
        "resistance": 1000,
        "position": 0.5,
        "label": ""
      }
    },
    "polarizedCapacitor": {
      "drawingScale": 3.125,
      "prefix": "C",
      "name": "Polarized capacitor",
      "pins": {
        "positive": [
          -150,
          0
        ],
        "negative": [
          150,
          0
        ]
      },
      "parameters": {
        "capacitance": 0.000001,
        "initialVoltage": 0,
        "integration": "backwardEuler",
        "maxReverseVoltage": 1
      }
    },
    "analogSwitch": {
      "drawingScale": 3.125,
      "prefix": "S",
      "name": "Analog switch (SPST)",
      "pins": {
        "a": [
          -150,
          0
        ],
        "b": [
          150,
          0
        ],
        "control": [
          0,
          -100
        ]
      },
      "parameters": {
        "onResistance": 20,
        "offResistance": 10000000000,
        "threshold": 2.5,
        "inverted": false,
        "pulldown": true
      }
    },
    "analogSpdtSwitch": {
      "drawingScale": 3.125,
      "prefix": "S",
      "name": "Analog switch (SPDT)",
      "pins": {
        "common": [
          -150,
          0
        ],
        "a": [
          150,
          -50
        ],
        "b": [
          150,
          50
        ],
        "control": [
          0,
          100
        ]
      },
      "parameters": {
        "onResistance": 20,
        "offResistance": 10000000000,
        "threshold": 2.5,
        "inverted": false,
        "pulldown": true
      }
    },
    "output": {
      "drawingScale": 3.125,
      "prefix": "O",
      "name": "Output marker",
      "pins": {
        "in": [
          -150,
          0
        ]
      },
      "parameters": {
        "showVoltage": true
      }
    },
    "logicOutput": {
      "drawingScale": 3.125,
      "prefix": "M",
      "name": "Logic output",
      "pins": {
        "in": [
          -150,
          0
        ]
      },
      "parameters": {
        "threshold": 2.5,
        "mode": "logic",
        "pulldown": false
      }
    },
    "logicInput": {
      "drawingScale": 3.125,
      "prefix": "L",
      "name": "Logic input",
      "pins": {
        "out": [
          150,
          0
        ]
      },
      "parameters": {
        "state": 1,
        "highVoltage": 5,
        "lowVoltage": 0,
        "mode": "logic"
      }
    },
    "pushSwitch": {
      "drawingScale": 3.125,
      "prefix": "S",
      "name": "Push switch",
      "pins": {
        "a": [
          -150,
          0
        ],
        "b": [
          150,
          0
        ]
      },
      "parameters": {
        "onResistance": 0,
        "momentary": true,
        "linkLabel": "",
        "iecSymbol": false,
        "normallyClosed": false
      }
    },
    "mbbSwitch": {
      "drawingScale": 3.125,
      "prefix": "S",
      "name": "Make-before-break switch",
      "pins": {
        "common": [
          -150,
          0
        ],
        "a": [
          150,
          -50
        ],
        "b": [
          150,
          50
        ]
      },
      "parameters": {
        "onResistance": 0,
        "momentary": false,
        "linkLabel": "",
        "iecSymbol": false,
        "group": 0,
        "position": 0
      }
    },
    "tappedTransformer": {
      "drawingScale": 3.125,
      "prefix": "T",
      "name": "Tapped transformer",
      "pins": {
        "p1": [
          -100,
          -150
        ],
        "p2": [
          -100,
          150
        ],
        "s1": [
          100,
          -150
        ],
        "tap": [
          100,
          0
        ],
        "s2": [
          100,
          150
        ]
      },
      "parameters": {
        "inductance": 4,
        "ratio": 1,
        "coupling": 0.99,
        "integration": "backwardEuler"
      }
    },
    "customTransformer": {
      "drawingScale": 3.125,
      "prefix": "T",
      "name": "Custom transformer (three windings)",
      "pins": {
        "p1a": [
          -100,
          -200
        ],
        "p1b": [
          -100,
          -100
        ],
        "p2a": [
          -100,
          0
        ],
        "p2b": [
          -100,
          200
        ],
        "sa": [
          100,
          -200
        ],
        "sb": [
          100,
          200
        ]
      },
      "parameters": {
        "inductance": 4,
        "coupling": 0.999,
        "turns1": 1,
        "turns2": 1,
        "turns3": 1,
        "integration": "backwardEuler"
      }
    },
    "transmissionLine": {
      "drawingScale": 3.125,
      "prefix": "TL",
      "name": "Transmission line",
      "pins": {
        "leftReturn": [
          -150,
          50
        ],
        "rightReturn": [
          150,
          50
        ],
        "left": [
          -150,
          -50
        ],
        "right": [
          150,
          -50
        ]
      },
      "parameters": {
        "delay": 0.001,
        "impedance": 75
      }
    },
    "counter": {
      "drawingScale": 3.125,
      "prefix": "U",
      "name": "Counter (4 bit)",
      "pins": {
        "clock": [
          -150,
          -150
        ],
        "reset": [
          -150,
          150
        ],
        "Q3": [
          150,
          -150
        ],
        "Q2": [
          150,
          -50
        ],
        "Q1": [
          150,
          50
        ],
        "Q0": [
          150,
          150
        ]
      },
      "parameters": {
        "highVoltage": 5,
        "initialValue": 0,
        "modulus": 0,
        "invertReset": true,
        "negativeEdge": false
      }
    },
    "latch": {
      "drawingScale": 3.125,
      "prefix": "U",
      "name": "Latch / register (4 bit)",
      "pins": {
        "I0": [
          -150,
          100
        ],
        "I1": [
          -150,
          0
        ],
        "I2": [
          -150,
          -100
        ],
        "I3": [
          -150,
          -200
        ],
        "O0": [
          150,
          100
        ],
        "O1": [
          150,
          0
        ],
        "O2": [
          150,
          -100
        ],
        "O3": [
          150,
          -200
        ],
        "load": [
          -150,
          200
        ]
      },
      "parameters": {
        "highVoltage": 5,
        "initialValue": 0,
        "edgeTriggered": true
      }
    },
    "halfAdder": {
      "drawingScale": 3.125,
      "prefix": "U",
      "name": "Half adder",
      "pins": {
        "sum": [
          150,
          -50
        ],
        "carry": [
          150,
          50
        ],
        "A": [
          -150,
          -50
        ],
        "B": [
          -150,
          50
        ]
      },
      "parameters": {
        "highVoltage": 5
      }
    },
    "fullAdder": {
      "drawingScale": 3.125,
      "prefix": "U",
      "name": "Adder (4 bit)",
      "pins": {
        "A0": [
          -150,
          -100
        ],
        "A1": [
          -150,
          -200
        ],
        "A2": [
          -150,
          -300
        ],
        "A3": [
          -150,
          -400
        ],
        "B0": [
          -150,
          300
        ],
        "B1": [
          -150,
          200
        ],
        "B2": [
          -150,
          100
        ],
        "B3": [
          -150,
          0
        ],
        "S0": [
          150,
          100
        ],
        "S1": [
          150,
          0
        ],
        "S2": [
          150,
          -100
        ],
        "S3": [
          150,
          -200
        ],
        "carryIn": [
          -150,
          400
        ],
        "carryOut": [
          150,
          -400
        ]
      },
      "parameters": {
        "highVoltage": 5
      }
    },
    "dFlipFlop": {
      "drawingScale": 3.125,
      "prefix": "U",
      "name": "D flip-flop",
      "pins": {
        "D": [
          -150,
          -50
        ],
        "clock": [
          -150,
          50
        ],
        "Q": [
          150,
          -50
        ],
        "Qn": [
          150,
          50
        ]
      },
      "parameters": {
        "highVoltage": 5,
        "initialState": false
      }
    },
    "jkFlipFlop": {
      "drawingScale": 3.125,
      "prefix": "U",
      "name": "JK flip-flop",
      "pins": {
        "J": [
          -150,
          -100
        ],
        "clock": [
          -150,
          0
        ],
        "K": [
          -150,
          100
        ],
        "Q": [
          150,
          -100
        ],
        "Qn": [
          150,
          100
        ]
      },
      "parameters": {
        "highVoltage": 5,
        "initialState": false,
        "positiveEdge": false
      }
    },
    "tFlipFlop": {
      "drawingScale": 3.125,
      "prefix": "U",
      "name": "T flip-flop",
      "pins": {
        "T": [
          -150,
          -50
        ],
        "clock": [
          -150,
          50
        ],
        "Q": [
          150,
          -50
        ],
        "Qn": [
          150,
          50
        ]
      },
      "parameters": {
        "highVoltage": 5,
        "initialState": false
      }
    },
    "capacitor": {
      "drawingScale": 3.125,
      "prefix": "C",
      "name": "Capacitor",
      "pins": {
        "a": [
          -75,
          0
        ],
        "b": [
          75,
          0
        ]
      },
      "parameters": {
        "capacitance": 0.000001,
        "initialVoltage": 0,
        "integration": "backwardEuler"
      }
    },
    "voltageSource": {
      "drawingScale": 3.125,
      "prefix": "V",
      "name": "DC source (2 terminals)",
      "pins": {
        "p": [
          0,
          -150
        ],
        "n": [
          0,
          150
        ]
      },
      "parameters": {
        "waveform": {
          "kind": "dc",
          "voltage": 5
        }
      }
    },
    "voltageRail": {
      "drawingScale": 3.125,
      "prefix": "V",
      "name": "DC source (1 terminal)",
      "pins": {
        "p": [
          0,
          100
        ]
      },
      "parameters": {
        "waveform": {
          "kind": "dc",
          "voltage": 5
        }
      }
    },
    "switch": {
      "drawingScale": 3.125,
      "prefix": "S",
      "name": "Switch",
      "pins": {
        "a": [
          -150,
          0
        ],
        "b": [
          150,
          0
        ]
      },
      "parameters": {
        "onResistance": 0,
        "momentary": false,
        "linkLabel": "",
        "iecSymbol": false,
        "closed": false
      }
    },
    "opamp": {
      "drawingScale": 3.125,
      "prefix": "U",
      "name": "Op-amp",
      "pins": {
        "minus": [
          -150,
          -50
        ],
        "plus": [
          -150,
          50
        ],
        "out": [
          150,
          0
        ]
      },
      "parameters": {
        "gain": 100000,
        "minOutput": -15,
        "maxOutput": 15
      }
    },
    "ground": {
      "prefix": "G",
      "name": "Ground",
      "pins": {
        "g": [
          0,
          0
        ]
      },
      "parameters": {}
    },
    "xnorGate": {
      "drawingScale": 3.125,
      "prefix": "U",
      "name": "XNOR gate",
      "pins": {
        "a": [
          -150,
          -50
        ],
        "b": [
          -150,
          50
        ],
        "out": [
          150,
          0
        ]
      },
      "parameters": {
        "highVoltage": 5,
        "inputCount": 2,
        "propagationDelay": 0,
        "schmittInputs": false,
        "invertInputs": false
      }
    }
  };
  const placementPresets = {
    "acSource": {
      "kind": "voltageSource",
      "name": "AC source (2 terminals)",
      "parameters": {
        "waveform": {
          "kind": "sine",
          "amplitude": 1,
          "frequency": 1000,
          "offset": 0
        }
      }
    },
    "squareRail": {
      "kind": "voltageRail",
      "name": "Square wave source (1 terminal)",
      "parameters": {
        "waveform": {
          "kind": "square",
          "amplitude": 5,
          "frequency": 40,
          "offset": 0,
          "dutyCycle": 0.5
        }
      }
    },
    "clockRail": {
      "kind": "voltageRail",
      "name": "Clock",
      "parameters": {
        "waveform": {
          "kind": "square",
          "amplitude": 2.5,
          "frequency": 100,
          "offset": 2.5,
          "dutyCycle": 0.5
        }
      }
    },
    "opampPlusTop": {
      "kind": "opamp",
      "name": "Op-amp (+ on top)"
    },
    "acRail": {
      "kind": "voltageRail",
      "name": "AC source (1 terminal)",
      "parameters": {
        "waveform": {
          "kind": "sine",
          "amplitude": 1,
          "frequency": 1000,
          "offset": 0
        }
      }
    }
  };
  // END GENERATED SYMBOL CATALOG
  const definitions={
    ...Object.fromEntries(Object.entries(outputSpecs).map(([kind,spec])=>[kind,{prefix:spec.prefix,name:spec.name,drawingScale:spec.drawingScale,pins:spec.pins,parameters:spec.parameters}])),
    ...basicDefinitions
  };
  // Public models copied from the bundled Falstad DiodeModel, excluding internal entries.
  const diodeModelSpecs = Object.freeze({
    'default': {saturationCurrent:1.7143528192808883e-7,seriesResistance:0,emissionCoefficient:2,breakdownVoltage:0},
    'spice-default': {saturationCurrent:1e-14,seriesResistance:0,emissionCoefficient:1,breakdownVoltage:0},
    'default-zener': {saturationCurrent:1.7143528192808883e-7,seriesResistance:0,emissionCoefficient:2,breakdownVoltage:5.6},
    'default-led': {saturationCurrent:93.2e-12,seriesResistance:.042,emissionCoefficient:3.73,breakdownVoltage:0},
    'default-optocoupler-led': {saturationCurrent:1.714e-7,seriesResistance:0,emissionCoefficient:4.077,breakdownVoltage:0},
    '1N5711': {saturationCurrent:315e-9,seriesResistance:2.8,emissionCoefficient:2.03,breakdownVoltage:70},
    '1N5712': {saturationCurrent:680e-12,seriesResistance:12,emissionCoefficient:1.003,breakdownVoltage:20},
    'BAT85': {saturationCurrent:2.076e-7,seriesResistance:2.326,emissionCoefficient:1.023,breakdownVoltage:33},
    '1N4004': {saturationCurrent:18.8e-9,seriesResistance:28.6e-3,emissionCoefficient:2,breakdownVoltage:400},
    '1N4148': {saturationCurrent:4.352e-9,seriesResistance:.6458,emissionCoefficient:1.906,breakdownVoltage:75}
  });
  const diodeModels = Object.freeze(Object.keys(diodeModelSpecs));
  const diodeKind=kind=>['diode','led','zener'].includes(kind);
  function resolveDiodeModel(model) {
    if(typeof model==='string') {
      if(!Object.hasOwn(diodeModelSpecs,model))throw new Error('Unknown diode model');
      return {...diodeModelSpecs[model]};
    }
    if(!model||typeof model!=='object'||Array.isArray(model))throw new Error('Invalid custom diode model');
    const keys=['name','mode','saturationCurrent','breakdownVoltage',...(model.mode==='simple'?['forwardVoltage','forwardCurrent']:['seriesResistance','emissionCoefficient'])];
    if(Object.keys(model).length!==keys.length||!keys.every(k=>Object.hasOwn(model,k))||
        !['simple','advanced'].includes(model.mode)||typeof model.name!=='string'||!model.name.trim()||model.name.length>80||/[\x00-\x1f]/.test(model.name)||diodeModels.includes(model.name))
      throw new Error('Custom diode models need a unique name and simple or advanced parameters');
    const positive=v=>Number.isFinite(v)&&v>0&&Number.isFinite(1/v);
    if(!positive(model.saturationCurrent)||!Number.isFinite(model.breakdownVoltage)||model.breakdownVoltage<0)
      throw new Error('Diode saturation current must be positive and breakdown voltage nonnegative');
    const emissionCoefficient=model.mode==='simple'?
      model.forwardVoltage/(Math.log1p(model.forwardCurrent/model.saturationCurrent)*.025865):model.emissionCoefficient;
    const seriesResistance=model.mode==='simple'?0:model.seriesResistance;
    if(model.mode==='simple'&&(!positive(model.forwardVoltage)||!positive(model.forwardCurrent)))
      throw new Error('Simple diode forward voltage and current must be positive');
    if(!positive(emissionCoefficient)||!Number.isFinite(seriesResistance)||seriesResistance<0||
        seriesResistance>0&&!Number.isFinite(1/seriesResistance)||
        !Number.isFinite(1/(emissionCoefficient*.025865))||
        !Number.isFinite(Math.log1p(1/model.saturationCurrent)*emissionCoefficient*.025865))
      throw new Error('Invalid diode series resistance or emission coefficient');
    return {saturationCurrent:model.saturationCurrent,seriesResistance,emissionCoefficient,breakdownVoltage:model.breakdownVoltage};
  }
  function validateDiodeParameters(kind,p) {
    if(!p||typeof p!=='object'||Array.isArray(p))throw new Error('Invalid diode parameters');
    const named=Object.hasOwn(p,'model');
    const keys=kind==='diode'?(named?['model']:[]):named?
      (kind==='led'?['model','maxCurrent','red','green','blue']:['model']):
      ['forwardVoltage',kind==='led'?'maxCurrent':'breakdownVoltage'];
    if(Object.keys(p).length!==keys.length||!keys.every(k=>Object.hasOwn(p,k)))throw new Error('Unexpected or missing diode parameters');
    if(named){const model=resolveDiodeModel(p.model);if(kind==='zener'&&model.breakdownVoltage<=0)throw new Error('Zener models require a positive breakdown voltage');}
    if(!named&&kind!=='diode'&&(!Number.isFinite(p.forwardVoltage)||p.forwardVoltage<=0||!Number.isFinite(p[kind==='led'?'maxCurrent':'breakdownVoltage'])||p[kind==='led'?'maxCurrent':'breakdownVoltage']<=0))throw new Error('Invalid legacy diode parameters');
    if(named&&kind==='led'&&(!Number.isFinite(p.maxCurrent)||p.maxCurrent<=0||!['red','green','blue'].every(k=>Number.isFinite(p[k])&&p[k]>=0&&p[k]<=1)))throw new Error('LED colors must be from 0 to 1 and brightness current positive');
    return structuredClone(p);
  }
  function diodeEditorParameters(kind,p) {
    if(Object.hasOwn(p,'model'))return structuredClone(p);
    if(kind==='diode')return {model:'default'};
    // Preserve the I/V curve of existing forward-voltage-based saved components.
    return {model:{name:'Imported '+kind+' '+p.forwardVoltage+(kind==='zener'?' / '+p.breakdownVoltage:''),mode:'simple',saturationCurrent:1/Math.expm1(p.forwardVoltage/(2*.025865)),breakdownVoltage:kind==='zener'?p.breakdownVoltage:0,forwardVoltage:p.forwardVoltage,forwardCurrent:1},
      ...(kind==='led'?{maxCurrent:p.maxCurrent,red:1,green:0,blue:0}:{})};
  }
  function validateSharedDiodeModels(components) {
    const models=new Map();
    for(const c of components){
      if(!diodeKind(c.kind))continue;
      validateDiodeParameters(c.kind,c.parameters);
      const model=c.parameters.model;
      if(!model||typeof model!=='object')continue;
      const definition=JSON.stringify([model.mode,...Object.entries(model).filter(([k])=>k!=='name').sort(([a],[b])=>a.localeCompare(b))]);
      if(models.has(model.name)&&models.get(model.name)!==definition)throw new Error('Conflicting definitions for diode model '+model.name);
      models.set(model.name,definition);
    }
  }
  const transistorModelFields = {
    saturationCurrent:{label:'Transport saturation current (IS) · A',default:1e-13,positive:true},
    reverseBeta:{label:'Reverse beta (BR)',default:1,positive:true},
    forwardEarlyVoltage:{label:'Forward Early voltage (VAF) · V (0 = disabled)',default:0},
    reverseEarlyVoltage:{label:'Reverse Early voltage (VAR) · V (0 = disabled)',default:0},
    forwardRollOff:{label:'Forward beta roll-off current (IKF) · A (0 = disabled)',default:0},
    reverseRollOff:{label:'Reverse beta roll-off current (IKR) · A (0 = disabled)',default:0},
    forwardEmissionCoefficient:{label:'Forward emission coefficient (NF)',default:1,positive:true},
    reverseEmissionCoefficient:{label:'Reverse emission coefficient (NR)',default:1,positive:true},
    beLeakageCurrent:{label:'B-E leakage saturation current (ISE) · A',default:0},
    beLeakageEmissionCoefficient:{label:'B-E leakage emission coefficient (NE)',default:1.5,positive:true},
    bcLeakageCurrent:{label:'B-C leakage saturation current (ISC) · A',default:0},
    bcLeakageEmissionCoefficient:{label:'B-C leakage emission coefficient (NC)',default:2,positive:true},
    beCapacitance:{label:'B-E zero-bias junction capacitance (CJE) · F',default:0},
    beJunctionPotential:{label:'B-E junction potential (VJE) · V',default:.75,positive:true},
    beGradingCoefficient:{label:'B-E grading coefficient (MJE)',default:.33,positive:true},
    bcCapacitance:{label:'B-C zero-bias junction capacitance (CJC) · F',default:0},
    bcJunctionPotential:{label:'B-C junction potential (VJC) · V',default:.75,positive:true},
    bcGradingCoefficient:{label:'B-C grading coefficient (MJC)',default:.33,positive:true},
    forwardTransitTime:{label:'Forward transit time (TF) · s',default:0},
    reverseTransitTime:{label:'Reverse transit time (TR) · s',default:0}
  };
  const transistorModels=['default','spice-default'];
  const transistorKind=kind=>['npn','pnp'].includes(kind);
  function resolveTransistorModel(model) {
    if(typeof model==='string') {
      if(!transistorModels.includes(model))throw new Error('Unknown transistor model');
      return {...Object.fromEntries(Object.entries(transistorModelFields).map(([k,f])=>[k,f.default])),saturationCurrent:model==='default'?1e-13:1e-16};
    }
    const fields=Object.keys(transistorModelFields);
    if(!model||typeof model!=='object'||Array.isArray(model)||Object.keys(model).length!==fields.length+1||
        !fields.every(k=>Object.hasOwn(model,k))||typeof model.name!=='string'||!model.name.trim()||model.name.length>80||/[\x00-\x1f]/.test(model.name)||transistorModels.includes(model.name))
      throw new Error('Invalid custom transistor model name or fields');
    for(const [key,field] of Object.entries(transistorModelFields)){
      const v=model[key];
      if(!Number.isFinite(v)||v<0||(field.positive&&v===0)||(v>0&&!Number.isFinite(1/v)))throw new Error('Invalid '+field.label);
    }
    return Object.fromEntries(fields.map(k=>[k,model[k]]));
  }
  function validateTransistorParameters(p) {
    const named=Object.hasOwn(p,'model'),keys=['beta',...(named?['model']:[]),...['swapTerminals','drawCircle'].filter(k=>Object.hasOwn(p,k))];
    if(Object.keys(p).length!==keys.length||!keys.every(k=>Object.hasOwn(p,k))||!Number.isFinite(p.beta)||p.beta<=0||!Number.isFinite(1/p.beta))throw new Error('Invalid transistor parameters');
    if(['swapTerminals','drawCircle'].some(k=>Object.hasOwn(p,k)&&typeof p[k]!=='boolean'))throw new Error('Invalid transistor swap option');
    if(named)resolveTransistorModel(p.model);
    return structuredClone(p);
  }
  function validateSharedTransistorModels(components) {
    const models=new Map();
    for(const c of components){
      if(!transistorKind(c.kind))continue;
      validateTransistorParameters(c.parameters);
      const m=c.parameters.model;
      if(!m||typeof m!=='object')continue;
      const definition=JSON.stringify(resolveTransistorModel(m));
      if(models.has(m.name)&&models.get(m.name)!==definition)throw new Error('Conflicting definitions for transistor model '+m.name);
      models.set(m.name,definition);
    }
  }
  const gateKind=kind=>['andGate','nandGate','orGate','norGate','xorGate','xnorGate'].includes(kind);
  function gateOffsets(count) {
    let i=-Math.floor(count/2);
    return Array.from({length:count},()=>{if(i===0&&count%2===0)i++;return 16*i++;});
  }
  function validateGateParameters(p) {
    const optional=['inputCount','propagationDelay','schmittInputs','invertInputs'];
    if(!p||Object.keys(p).some(k=>!['highVoltage',...optional].includes(k))||!Number.isFinite(p.highVoltage)||p.highVoltage<=0||
      !Number.isInteger(p.inputCount??2)||(p.inputCount??2)<1||(p.inputCount??2)>8||
      !Number.isFinite(p.propagationDelay??0)||(p.propagationDelay??0)<0||
      ['schmittInputs','invertInputs'].some(k=>Object.hasOwn(p,k)&&typeof p[k]!=='boolean'))throw new Error('Invalid gate input count, delay or logic parameters');
    return structuredClone(p);
  }
  function componentPins(component) {
    const kind=component.kind,p=component.parameters||{};
    if(gateKind(kind)) {
      if(!Number.isInteger(p.inputCount??2)||(p.inputCount??2)<1||(p.inputCount??2)>8)throw new Error('Gate input count must be 1 to 8');
      if((p.inputCount??2)===2)return definitions[kind].pins;
      return {...Object.fromEntries(gateOffsets(p.inputCount??2).map((y,i)=>[String.fromCharCode(97+i),[-150,y*3.125]])),out:[150,0]};
    }
    if(kind==='spdtSwitch'&&(p.throwCount??2)!==2){
      const count=p.throwCount;
      if(!Number.isInteger(count)||count<2||count>10)throw new Error('Invalid throw count');
      return {common:[-150,0],...Object.fromEntries(Array.from({length:count},(_,i)=>[i<2?['a','b'][i]:'throw'+(i+1),[150,50*(i-Math.floor((count-1)/2))]]))};
    }
    if(kind==='dpdtSwitch'&&(p.poleCount??2)!==2){
      if(!Number.isInteger(p.poleCount)||p.poleCount<1||p.poleCount>8)throw new Error('Invalid pole count');
      return Object.fromEntries(Array.from({length:p.poleCount},(_,i)=>[['common'+(i+1),[-150,-100+i*150]],['a'+(i+1),[150,-50+i*150]],['b'+(i+1),[150,-150+i*150]]]).flat());
    }
    if(transistorKind(kind)&&p.swapTerminals){const pins=definitions[kind].pins;return {...pins,collector:pins.emitter,emitter:pins.collector};}
    if(mosfetKind(kind)) {
      const pins={...definitions[kind].pins};
      if(p.swapTerminals){const source=pins.source;pins.source=pins.drain;pins.drain=source;}
      if(activeBody(p))pins.body=[150,0];
      return pins;
    }
    return definitions[kind].pins;
  }
  function componentModel(component) {
    const model=simulationModels[component.kind];
    if(gateKind(component.kind)||mosfetKind(component.kind)||['spdtSwitch','dpdtSwitch'].includes(component.kind)){const pins=Object.keys(componentPins(component));return {...model,pins,postOrder:pins};}
    return model;
  }
  const mosfetKind=kind=>['nmos','pmos'].includes(kind);
  const mosfetOptions={bodyDiode:true,bodyTerminal:false,showBulk:true,digitalSymbol:false,showBodyDiode:false,swapTerminals:false};
  const activeBody=p=>p.bodyDiode===true&&p.bodyTerminal===true&&p.showBulk!==false&&!p.digitalSymbol;
  function validateMosfetParameters(p) {
    if(!p||Object.keys(p).some(k=>!['threshold','beta',...Object.keys(mosfetOptions)].includes(k))||
      !Number.isFinite(p.threshold)||!Number.isFinite(p.beta)||p.beta<=0||!Number.isFinite(1/p.beta)||
      Object.keys(mosfetOptions).some(k=>Object.hasOwn(p,k)&&typeof p[k]!=='boolean'))throw new Error('Invalid MOSFET parameters');
    return structuredClone(p);
  }
  const switchKind=kind=>['switch','pushSwitch','spdtSwitch','dpdtSwitch','mbbSwitch'].includes(kind);
  function switchDefaults(kind){return {onResistance:0,momentary:kind==='pushSwitch',linkLabel:'',iecSymbol:false,
    ...(kind==='spdtSwitch'?{group:0,throwCount:2,centerOff:false}:kind==='mbbSwitch'?{group:0}:kind==='dpdtSwitch'?{poleCount:2}:{})};}
  const switchPositionCount=c=>c.kind==='spdtSwitch'?((c.parameters.centerOff??false)&&(c.parameters.throwCount??2)===2?3:c.parameters.throwCount??2):c.kind==='mbbSwitch'?4:2;
  const momentary=c=>switchKind(c?.kind)&&(c.parameters.momentary??c.kind==='pushSwitch');
  function validateSwitchParameters(kind,p){
    const defaults=switchDefaults(kind),state=kind==='switch'?'closed':kind==='pushSwitch'?'normallyClosed':'position';
    if(!p||Object.keys(p).some(k=>![state,...Object.keys(defaults)].includes(k)))throw new Error('Unexpected switch parameters');
    const v={...defaults,...p},positive=v=>Number.isFinite(v)&&v>=0&&(v===0||Number.isFinite(1/v));
    if(!positive(v.onResistance)||typeof v.momentary!=='boolean'||typeof v.iecSymbol!=='boolean'||
      typeof v.linkLabel!=='string'||v.linkLabel.length>80||/[\x00-\x1f]/.test(v.linkLabel)||
      (['switch','pushSwitch'].includes(kind)?typeof v[state]!=='boolean':!Number.isInteger(v.position)||v.position<0||v.position>=switchPositionCount({kind,parameters:v})))throw new Error('Invalid switch state, resistance, label or shortcut');
    if(kind==='spdtSwitch'&&(!Number.isInteger(v.throwCount)||v.throwCount<2||v.throwCount>10||typeof v.centerOff!=='boolean'||v.throwCount>2&&v.momentary))throw new Error('Switch requires 2 to 10 throws; momentary operation requires 2 throws');
    if(kind==='dpdtSwitch'&&(!Number.isInteger(v.poleCount)||v.poleCount<1||v.poleCount>8))throw new Error('Switch requires 1 to 8 poles');
    if(['spdtSwitch','mbbSwitch'].includes(kind)&&(!Number.isInteger(v.group)||v.group<0||v.group>1000))throw new Error('Switch group must be from 0 to 1000');
    return structuredClone(p);
  }
  function switchPairs(c){
    const p=c.pins,v=c.parameters;
    if(c.kind==='spdtSwitch')return (v.centerOff??false)&&(v.throwCount??2)===2&&v.position===2?[]:[[p.common,p[v.position<2?['a','b'][v.position]:'throw'+(v.position+1)]]];
    if(c.kind==='dpdtSwitch')return Array.from({length:v.poleCount??2},(_,i)=>[p['common'+(i+1)],p[(v.position===0?'a':'b')+(i+1)]]);
    if(c.kind==='mbbSwitch')return v.position%2?[[p.common,p.a],[p.common,p.b]]:[[p.common,v.position===0?p.a:p.b]];
    return [];
  }
  function switchPostPoints(c,x){
    const v=c.parameters;
    if(c.kind==='spdtSwitch'){
      const count=v.throwCount??2;
      return [[x,32],...Array.from({length:count},(_,i)=>[x+64,count===2?(i===0?16:48):32+16*(i-Math.floor((count-1)/2))])];
    }
    if(c.kind==='dpdtSwitch')return Array.from({length:v.poleCount??2},(_,i)=>[[x,32+i*48],[x+64,48+i*48],[x+64,16+i*48]]).flat();
    if(c.kind==='mbbSwitch')return [[x,32],[x+64,16],[x+64,48]];
    return null;
  }
  const graphic=kind=>['text','box','line'].includes(kind);
  function validateOutput(component,timeStep){
    const spec=outputSpecs[component.kind],fields=Object.keys(spec.fields),raw=component.parameters;
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Invalid component parameters');
    const p={...Object.fromEntries(Object.entries(spec.fields).filter(([,f])=>f.optional).map(([k,f])=>[k,f.default])),...raw};
    if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).length!==fields.length||!fields.every(k=>Object.hasOwn(p,k)))throw new Error('Unexpected or missing '+component.kind+' parameters');
    for(const [key,f] of Object.entries(spec.fields)){
      const v=p[key];
      if(f.type==='string'){if(typeof v!=='string'||v.length>f.maxLength||v.includes('\0'))throw new Error('Invalid '+f.label);}
      else if(f.type==='boolean'){if(typeof v!=='boolean')throw new Error('Invalid '+f.label);}
      else if(!Number.isFinite(v)||(f.integer&&!Number.isInteger(v))||(f.min!==undefined&&v<f.min)||(f.max!==undefined&&v>f.max)||(f.exclusiveMin!==undefined&&v<=f.exclusiveMin)||(f.choices&&!f.choices.includes(v)))throw new Error('Invalid '+f.label);
    }
    if(component.kind==='variableVoltage'&&(!(p.minVoltage<p.maxVoltage)||!Number.isFinite(p.maxVoltage-p.minVoltage)||p.voltage<p.minVoltage||p.voltage>p.maxVoltage))throw new Error('Voltage must lie within the ordered source range');
    if (component.kind==='sweepSource') {
      const {minFrequency:min,maxFrequency:max,sweepTime:duration,logarithmic}=p;
      if (!(max>=min && Number.isFinite(2*Math.PI*max) && duration>=timeStep) ||
          (logarithmic ? !Number.isFinite(max/min) || !Number.isFinite(Math.pow(max/min,timeStep/duration)*max) :
            !Number.isFinite(timeStep*(max-min)/duration+max)))
        throw new Error('Sweep requires ordered frequencies, a finite sweep rate and a duration of at least one timestep');
    }
    if (component.kind==='amSource'||component.kind==='fmSource') {
      if (!Number.isFinite(2*Math.PI*(p.carrierFrequency+(p.deviation??0))) ||
          !Number.isFinite(2*Math.PI*p.signalFrequency)) throw new Error('Invalid modulation frequency');
    }
    if (component.kind==='noiseSource'&&(!Number.isFinite(p.offset+p.amplitude)||!Number.isFinite(p.offset-p.amplitude)))
      throw new Error('Noise voltage range must be finite');
    if (['schmittTrigger','invertingSchmittTrigger'].includes(component.kind)&&
        (!(p.lowerThreshold<p.upperThreshold)||!(p.lowVoltage<p.highVoltage)||!Number.isFinite(p.highVoltage-p.lowVoltage)))
      throw new Error('Schmitt trigger thresholds and output levels must be ordered');
    if (['sparkGap','diac','memristor'].includes(component.kind)&&
        (p.offResistance<p.onResistance || !Number.isFinite(1/p.onResistance) || !Number.isFinite(1/p.offResistance)))
      throw new Error('Expected positive, ordered on and off resistances');
    if (['sparkGap','diac'].includes(component.kind)&&!Number.isFinite(1/p.breakdownVoltage))
      throw new Error('Invalid breakdown voltage');
    if (component.kind==='memristor'&&(p.initialDopedWidth>p.totalWidth||!Number.isFinite(1/p.totalWidth)||
        !Number.isFinite(timeStep*p.mobility*p.onResistance/p.totalWidth)))
      throw new Error('Invalid memristor width or mobility');
    if (component.kind==='fuse'&&(!Number.isFinite(1/p.resistance)||!Number.isFinite(1/p.i2t)))
      throw new Error('Invalid fuse resistance or melting I²t');
    if (component.kind==='thermistor') {
      const {resistance25:r25,resistance50:r50,minTemperature:min,maxTemperature:max}=p;
      const beta=(Math.log(r25)-Math.log(r50))/(1/298.15-1/323.15);
      const resistance=t=>r25*Math.exp(beta*(1/(Math.round(t)+273.15)-1/298.15));
      if (!(r25>r50 && max>min && Number.isFinite(max-min) && Number.isFinite(1/r25) && Number.isFinite(1/r50) &&
          resistance(max)>=.5 && Number.isFinite(resistance(min))))
        throw new Error('Thermistor needs ordered resistance and temperature values with positive resistance throughout');
    }
    if (['scr','triac'].includes(component.kind)&&
        ![p.triggerCurrent,p.holdingCurrent,p.gateResistance].every(v=>Number.isFinite(1/v)))
      throw new Error('Invalid thyristor current or gate resistance');
    if (component.kind==='varactor'&&(!Number.isFinite(1/p.capacitance)||!Number.isFinite(timeStep/p.capacitance)))
      throw new Error('Invalid varactor capacitance');
    if (component.kind==='triode'&&(!Number.isFinite(1/p.mu)||!Number.isFinite(1/p.kg1)))
      throw new Error('Invalid triode parameters');
    if(component.kind==='labeledNode'&&!p.name.trim())throw new Error('Enter a net name');
    if(component.kind==='voltmeter'&&p.resistance!==0&&!Number.isFinite(1/p.resistance))throw new Error('Invalid meter resistance');
    if(component.kind==='audioOutput'&&(Math.floor(p.duration*p.sampleRate)<1||p.duration*p.sampleRate>1000000||timeStep>1/p.sampleRate))throw new Error('Audio capture needs 1 to 1000000 samples and a timestep no larger than its sample period');
    if(component.kind==='threePhaseMotor'&&(!Number.isFinite(p.statorInductance*p.rotorInductance)||p.statorInductance*p.rotorInductance<=p.mutualInductance*p.mutualInductance))throw new Error('Motor inductance matrix must be positive definite');
    if(component.kind==='instructionDisplay')for(const line of p.lookup.split('\n').filter(line=>line.trim())){
      const match=/^\s*(0x[0-9a-f]+|\d+)(?:\s*-\s*(0x[0-9a-f]+|\d+))?\s*=(.*)$/i.exec(line);
      if(!match||Number(match[1])>15||Number(match[2]??match[1])>15||Number(match[2]??match[1])<Number(match[1]))throw new Error('Lookup entries must use values/ranges from 0 to 15');
    }
    return Object.fromEntries(fields.map(key=>[key,p[key]]));
  }

  const waveformNames = { dc: 'DC', sine: 'Sine', square: 'Square', triangle: 'Triangle', sawtooth: 'Sawtooth', pulse: 'Pulse' };
  const placementDefinitions = {
    ...definitions,
    ...Object.fromEntries(Object.entries(placementPresets).map(([key,preset])=>[key,{
      ...definitions[preset.kind],...preset
    }]))
  };
  function validWaveform(w) {
    return w?.kind === 'dc' ? Number.isFinite(w.voltage) : ['sine', 'square', 'triangle', 'sawtooth', 'pulse'].includes(w?.kind) &&
      Number.isFinite(w.amplitude) && w.amplitude >= 0 && Number.isFinite(w.frequency) && w.frequency > 0 && Number.isFinite(2 * Math.PI * w.frequency) &&
      (!Object.hasOwn(w,'phase')||Number.isFinite(w.phase)) && Number.isFinite(w.offset) && Number.isFinite(w.offset + w.amplitude) && Number.isFinite(w.offset - w.amplitude) &&
      (!['square', 'pulse'].includes(w.kind) || (Number.isFinite(w.dutyCycle) && w.dutyCycle > 0 && w.dutyCycle < 1));
  }
  // Engine ordering is only specified where it differs from display pin order.
  const engineMetadata={
  "xnorGate": {
    "type": "431",
    "sign": -1
  },
  "npn": {
    "type": "t",
    "sign": null
  },
  "pnp": {
    "type": "t",
    "sign": null
  },
  "nmos": {
    "type": "f",
    "sign": 1
  },
  "pmos": {
    "type": "f",
    "sign": 1
  },
  "njfet": {
    "type": "j",
    "sign": 1
  },
  "pjfet": {
    "type": "j",
    "sign": 1
  },
  "andGate": {
    "type": "150",
    "sign": -1
  },
  "nandGate": {
    "type": "151",
    "sign": -1
  },
  "orGate": {
    "type": "152",
    "sign": -1
  },
  "norGate": {
    "type": "153",
    "sign": -1
  },
  "xorGate": {
    "type": "154",
    "sign": -1
  },
  "inverter": {
    "type": "I",
    "sign": -1
  },
  "transformer": {
    "type": "T",
    "sign": null
  },
  "spdtSwitch": {
    "type": "S",
    "sign": 1
  },
  "dpdtSwitch": {
    "type": "429",
    "sign": null
  },
  "led": {
    "type": "162",
    "sign": 1
  },
  "zener": {
    "type": "z",
    "sign": 1
  },
  "polarizedCapacitor": {
    "type": "209",
    "sign": 1
  },
  "analogSwitch": {
    "type": "159",
    "sign": 1
  },
  "analogSpdtSwitch": {
    "type": "160",
    "sign": 1
  },
  "output": {
    "type": "O",
    "sign": null
  },
  "logicOutput": {
    "type": "M",
    "sign": null
  },
  "logicInput": {
    "type": "L",
    "sign": -1
  },
  "pushSwitch": {
    "type": "s",
    "sign": 1
  },
  "mbbSwitch": {
    "type": "416",
    "sign": null
  },
  "tappedTransformer": {
    "type": "169",
    "sign": null
  },
  "customTransformer": {
    "type": "406",
    "sign": null
  },
  "transmissionLine": {
    "type": "171",
    "sign": null
  },
  "counter": {
    "type": "164",
    "sign": null
  },
  "latch": {
    "type": "168",
    "sign": null
  },
  "halfAdder": {
    "type": "195",
    "sign": null
  },
  "fullAdder": {
    "type": "196",
    "sign": null
  },
  "dFlipFlop": {
    "type": "155",
    "sign": null,
    "postOrder": [
      "D",
      "Q",
      "Qn",
      "clock"
    ]
  },
  "jkFlipFlop": {
    "type": "156",
    "sign": null
  },
  "tFlipFlop": {
    "type": "193",
    "sign": null,
    "postOrder": [
      "T",
      "Q",
      "Qn",
      "clock"
    ]
  },
  "resistor": {
    "type": "r",
    "sign": 1
  },
  "inductor": {
    "type": "l",
    "sign": 1
  },
  "diode": {
    "type": "d",
    "sign": 1
  },
  "currentSource": {
    "type": "i",
    "sign": 1
  },
  "potentiometer": {
    "type": "174",
    "sign": null
  },
  "capacitor": {
    "type": "c",
    "sign": 1
  },
  "switch": {
    "type": "s",
    "sign": 1
  },
  "voltageSource": {
    "type": "v",
    "sign": -1,
    "postOrder": [
      "n",
      "p"
    ]
  },
  "voltageRail": {
    "type": "R",
    "sign": -1
  },
  "opamp": {
    "type": "a",
    "sign": -1
  },
  "ground": {
    "type": "g",
    "sign": null
  }
};
  const simulationModels=Object.fromEntries(Object.entries(definitions).map(([kind,definition])=>{
    const metadata=outputSpecs[kind]||engineMetadata[kind],pins=Object.keys(definition.pins);
    if(!metadata)throw new Error('Missing simulation metadata: '+kind);
    const postOrder=metadata.postOrder||pins;
    if(pins.length!==postOrder.length||pins.some(pin=>!postOrder.includes(pin)))throw new Error('Catalog pin mismatch: '+kind);
    return [kind,{type:metadata.type,sign:metadata.sign,pins,postOrder}];
  }));
  // Placement grid: five 10-unit symbol design steps per interval.
  const api=Object.freeze({grid:50,switchKind,switchDefaults,switchPositionCount,momentary,validateSwitchParameters,switchPairs,switchPostPoints,mosfetKind,mosfetOptions,activeBody,validateMosfetParameters,gateKind,gateOffsets,validateGateParameters,componentPins,componentModel,transistorModels,transistorModelFields,transistorKind,resolveTransistorModel,validateTransistorParameters,validateSharedTransistorModels,diodeModels,diodeModelSpecs,diodeKind,resolveDiodeModel,validateDiodeParameters,diodeEditorParameters,validateSharedDiodeModels,definitions,placementDefinitions,outputSpecs,graphic,validateOutput,validWaveform,waveformNames,simulationModels});

  registry.catalog=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})();
