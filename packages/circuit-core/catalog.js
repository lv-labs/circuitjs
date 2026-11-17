'use strict';
// Portable computation module: no DOM, renderer, storage or worker construction.
(() => {
  const registry=globalThis.CircuitCoreModules ||= {};
  // BEGIN GENERATED SYMBOL CATALOG
  const outputSpecs = {
    "variableVoltage": {
      "name": "Variable voltage",
      "prefix": "V",
      "pins": {
        "p": [
          0,
          32
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
      "pins": {
        "a": [
          -48,
          0
        ],
        "b": [
          48,
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
      "pins": {},
      "type": "x",
      "fields": {
        "text": {
          "label": "Text",
          "type": "string",
          "maxLength": 4096,
          "default": "Text"
        },
        "size": {
          "label": "Font size",
          "type": "number",
          "min": 8,
          "max": 96,
          "integer": true,
          "default": 18
        }
      },
      "parameters": {
        "text": "Text",
        "size": 18
      },
      "sign": null
    },
    "box": {
      "name": "Box",
      "prefix": "BOX",
      "pins": {},
      "type": "b",
      "fields": {
        "width": {
          "label": "Width · canvas units",
          "type": "number",
          "min": 16,
          "max": 2048,
          "default": 128
        },
        "height": {
          "label": "Height · canvas units",
          "type": "number",
          "min": 16,
          "max": 2048,
          "default": 96
        }
      },
      "parameters": {
        "width": 128,
        "height": 96
      },
      "sign": null
    },
    "line": {
      "name": "Line",
      "prefix": "LINE",
      "pins": {},
      "type": "423",
      "fields": {
        "width": {
          "label": "Width · canvas units",
          "type": "number",
          "min": 16,
          "max": 2048,
          "default": 128
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
        "width": 128,
        "height": 0
      },
      "sign": null
    },
    "labeledNode": {
      "name": "Labeled node",
      "prefix": "NET",
      "pins": {
        "in": [
          -48,
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
      "pins": {
        "a": [
          -48,
          0
        ],
        "b": [
          48,
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
      "pins": {
        "a": [
          -48,
          0
        ],
        "b": [
          48,
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
      "pins": {
        "a": [
          -48,
          0
        ],
        "b": [
          48,
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
      "pins": {
        "returnIn": [
          -48,
          16
        ],
        "returnOut": [
          48,
          16
        ],
        "currentIn": [
          -48,
          -16
        ],
        "currentOut": [
          48,
          -16
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
      "pins": {
        "in": [
          -48,
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
      "pins": {
        "I0": [
          -48,
          48
        ],
        "I1": [
          -48,
          16
        ],
        "I2": [
          -48,
          -16
        ],
        "I3": [
          -48,
          -48
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
      "pins": {
        "I0": [
          -48,
          48
        ],
        "I1": [
          -48,
          16
        ],
        "I2": [
          -48,
          -16
        ],
        "I3": [
          -48,
          -48
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
      "pins": {
        "C0": [
          -112,
          160
        ],
        "C1": [
          -80,
          160
        ],
        "C2": [
          -48,
          160
        ],
        "C3": [
          -16,
          160
        ],
        "C4": [
          16,
          160
        ],
        "C5": [
          48,
          160
        ],
        "C6": [
          80,
          160
        ],
        "C7": [
          112,
          160
        ],
        "R0": [
          -160,
          -112
        ],
        "R1": [
          -160,
          -80
        ],
        "R2": [
          -160,
          -48
        ],
        "R3": [
          -160,
          -16
        ],
        "R4": [
          -160,
          16
        ],
        "R5": [
          -160,
          48
        ],
        "R6": [
          -160,
          80
        ],
        "R7": [
          -160,
          112
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
      "pins": {
        "in": [
          -48,
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
      "pins": {
        "in": [
          -48,
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
      "pins": {
        "in": [
          -48,
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
      "pins": {
        "a": [
          -48,
          0
        ],
        "b": [
          48,
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
      "pins": {
        "U1": [
          -48,
          -32
        ],
        "U2": [
          48,
          32
        ],
        "V1": [
          -48,
          0
        ],
        "V2": [
          48,
          0
        ],
        "W1": [
          -48,
          32
        ],
        "W2": [
          48,
          -32
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
      "pins": {
        "p": [
          0,
          32
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
      "pins": {
        "p": [
          0,
          32
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
      "pins": {
        "p": [
          0,
          32
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
      "pins": {
        "p": [
          0,
          32
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
      "pins": {
        "p": [
          0,
          32
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
      "pins": {
        "input": [
          -48,
          0
        ],
        "out": [
          48,
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
      "pins": {
        "input": [
          -48,
          0
        ],
        "out": [
          48,
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
      "pins": {
        "a": [
          -48,
          0
        ],
        "b": [
          48,
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
      "pins": {
        "a": [
          -48,
          0
        ],
        "b": [
          48,
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
      "pins": {
        "anode": [
          -48,
          0
        ],
        "cathode": [
          48,
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
      "pins": {
        "a": [
          -48,
          0
        ],
        "b": [
          48,
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
      "pins": {
        "a": [
          -48,
          0
        ],
        "b": [
          48,
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
      "pins": {
        "a": [
          -48,
          0
        ],
        "b": [
          48,
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
      "pins": {
        "anode": [
          -48,
          0
        ],
        "cathode": [
          48,
          0
        ],
        "gate": [
          16,
          32
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
      "pins": {
        "a": [
          -48,
          0
        ],
        "b": [
          48,
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
      "pins": {
        "mt2": [
          -48,
          0
        ],
        "mt1": [
          48,
          0
        ],
        "gate": [
          16,
          32
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
      "pins": {
        "anode": [
          -48,
          0
        ],
        "cathode": [
          48,
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
      "pins": {
        "plate": [
          32,
          -48
        ],
        "grid": [
          -48,
          0
        ],
        "cathode": [
          32,
          48
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
      "prefix": "Q",
      "name": "NPN transistor",
      "pins": {
        "base": [
          -48,
          0
        ],
        "collector": [
          48,
          -16
        ],
        "emitter": [
          48,
          16
        ]
      },
      "parameters": {
        "beta": 100
      }
    },
    "pnp": {
      "prefix": "Q",
      "name": "PNP transistor",
      "pins": {
        "base": [
          -48,
          0
        ],
        "collector": [
          48,
          16
        ],
        "emitter": [
          48,
          -16
        ]
      },
      "parameters": {
        "beta": 100
      }
    },
    "nmos": {
      "prefix": "Q",
      "name": "NMOS",
      "pins": {
        "gate": [
          -48,
          0
        ],
        "source": [
          48,
          16
        ],
        "drain": [
          48,
          -16
        ]
      },
      "parameters": {
        "threshold": 1.5,
        "beta": 0.02
      }
    },
    "pmos": {
      "prefix": "Q",
      "name": "PMOS",
      "pins": {
        "gate": [
          -48,
          0
        ],
        "source": [
          48,
          16
        ],
        "drain": [
          48,
          -16
        ]
      },
      "parameters": {
        "threshold": 1.5,
        "beta": 0.02
      }
    },
    "njfet": {
      "prefix": "Q",
      "name": "NJFET",
      "pins": {
        "gate": [
          -48,
          0
        ],
        "source": [
          48,
          16
        ],
        "drain": [
          48,
          -16
        ]
      },
      "parameters": {
        "threshold": -4,
        "beta": 0.00125
      }
    },
    "pjfet": {
      "prefix": "Q",
      "name": "PJFET",
      "pins": {
        "gate": [
          -48,
          0
        ],
        "source": [
          48,
          16
        ],
        "drain": [
          48,
          -16
        ]
      },
      "parameters": {
        "threshold": -4,
        "beta": 0.00125
      }
    },
    "andGate": {
      "prefix": "U",
      "name": "AND gate",
      "pins": {
        "a": [
          -48,
          -16
        ],
        "b": [
          -48,
          16
        ],
        "out": [
          48,
          0
        ]
      },
      "parameters": {
        "highVoltage": 5
      }
    },
    "nandGate": {
      "prefix": "U",
      "name": "NAND gate",
      "pins": {
        "a": [
          -48,
          -16
        ],
        "b": [
          -48,
          16
        ],
        "out": [
          48,
          0
        ]
      },
      "parameters": {
        "highVoltage": 5
      }
    },
    "orGate": {
      "prefix": "U",
      "name": "OR gate",
      "pins": {
        "a": [
          -48,
          -16
        ],
        "b": [
          -48,
          16
        ],
        "out": [
          48,
          0
        ]
      },
      "parameters": {
        "highVoltage": 5
      }
    },
    "norGate": {
      "prefix": "U",
      "name": "NOR gate",
      "pins": {
        "a": [
          -48,
          -16
        ],
        "b": [
          -48,
          16
        ],
        "out": [
          48,
          0
        ]
      },
      "parameters": {
        "highVoltage": 5
      }
    },
    "xorGate": {
      "prefix": "U",
      "name": "XOR gate",
      "pins": {
        "a": [
          -48,
          -16
        ],
        "b": [
          -48,
          16
        ],
        "out": [
          48,
          0
        ]
      },
      "parameters": {
        "highVoltage": 5
      }
    },
    "inverter": {
      "prefix": "U",
      "name": "Inverter",
      "pins": {
        "input": [
          -48,
          0
        ],
        "out": [
          48,
          0
        ]
      },
      "parameters": {
        "highVoltage": 5,
        "slewRate": 0.5
      }
    },
    "transformer": {
      "prefix": "T",
      "name": "Transformer",
      "pins": {
        "p1": [
          -32,
          -48
        ],
        "s1": [
          32,
          -48
        ],
        "p2": [
          -32,
          48
        ],
        "s2": [
          32,
          48
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
      "prefix": "S",
      "name": "SPDT switch (center off)",
      "pins": {
        "common": [
          -48,
          0
        ],
        "a": [
          48,
          -16
        ],
        "b": [
          48,
          16
        ]
      },
      "parameters": {
        "position": 0
      }
    },
    "dpdtSwitch": {
      "prefix": "S",
      "name": "DPDT switch",
      "pins": {
        "common1": [
          -48,
          -32
        ],
        "a1": [
          48,
          -16
        ],
        "b1": [
          48,
          -48
        ],
        "common2": [
          -48,
          16
        ],
        "a2": [
          48,
          32
        ],
        "b2": [
          48,
          0
        ]
      },
      "parameters": {
        "position": 0
      }
    },
    "led": {
      "prefix": "D",
      "name": "LED",
      "pins": {
        "anode": [
          -48,
          0
        ],
        "cathode": [
          48,
          0
        ]
      },
      "parameters": {
        "forwardVoltage": 2.1,
        "maxCurrent": 0.01
      }
    },
    "zener": {
      "prefix": "D",
      "name": "Zener diode",
      "pins": {
        "anode": [
          -48,
          0
        ],
        "cathode": [
          48,
          0
        ]
      },
      "parameters": {
        "forwardVoltage": 0.805904783,
        "breakdownVoltage": 5.6
      }
    },
    "resistor": {
      "prefix": "R",
      "name": "Resistor",
      "pins": {
        "a": [
          -24,
          0
        ],
        "b": [
          24,
          0
        ]
      },
      "parameters": {
        "resistance": 1000
      }
    },
    "inductor": {
      "prefix": "L",
      "name": "Inductor",
      "pins": {
        "a": [
          -48,
          0
        ],
        "b": [
          48,
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
      "prefix": "D",
      "name": "Diode",
      "pins": {
        "anode": [
          -48,
          0
        ],
        "cathode": [
          48,
          0
        ]
      },
      "parameters": {}
    },
    "currentSource": {
      "prefix": "I",
      "name": "DC current source",
      "pins": {
        "a": [
          -48,
          0
        ],
        "b": [
          48,
          0
        ]
      },
      "parameters": {
        "current": 0.01,
        "maxVoltage": 0
      }
    },
    "potentiometer": {
      "prefix": "RV",
      "name": "Potentiometer",
      "pins": {
        "a": [
          -48,
          0
        ],
        "b": [
          48,
          0
        ],
        "wiper": [
          0,
          32
        ]
      },
      "parameters": {
        "resistance": 1000,
        "position": 0.5,
        "label": ""
      }
    },
    "polarizedCapacitor": {
      "prefix": "C",
      "name": "Polarized capacitor",
      "pins": {
        "positive": [
          -48,
          0
        ],
        "negative": [
          48,
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
      "prefix": "S",
      "name": "Analog switch (SPST)",
      "pins": {
        "a": [
          -48,
          0
        ],
        "b": [
          48,
          0
        ],
        "control": [
          0,
          -32
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
      "prefix": "S",
      "name": "Analog switch (SPDT)",
      "pins": {
        "common": [
          -48,
          0
        ],
        "a": [
          48,
          -16
        ],
        "b": [
          48,
          16
        ],
        "control": [
          0,
          32
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
      "prefix": "O",
      "name": "Output marker",
      "pins": {
        "in": [
          -48,
          0
        ]
      },
      "parameters": {
        "showVoltage": true
      }
    },
    "logicOutput": {
      "prefix": "M",
      "name": "Logic output",
      "pins": {
        "in": [
          -48,
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
      "prefix": "L",
      "name": "Logic input",
      "pins": {
        "out": [
          48,
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
      "prefix": "S",
      "name": "Push switch",
      "pins": {
        "a": [
          -48,
          0
        ],
        "b": [
          48,
          0
        ]
      },
      "parameters": {
        "normallyClosed": false
      }
    },
    "mbbSwitch": {
      "prefix": "S",
      "name": "Make-before-break switch",
      "pins": {
        "common": [
          -48,
          0
        ],
        "a": [
          48,
          -16
        ],
        "b": [
          48,
          16
        ]
      },
      "parameters": {
        "position": 0
      }
    },
    "tappedTransformer": {
      "prefix": "T",
      "name": "Tapped transformer",
      "pins": {
        "p1": [
          -32,
          -48
        ],
        "p2": [
          -32,
          48
        ],
        "s1": [
          32,
          -48
        ],
        "tap": [
          32,
          0
        ],
        "s2": [
          32,
          48
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
      "prefix": "T",
      "name": "Custom transformer (three windings)",
      "pins": {
        "p1a": [
          -32,
          -64
        ],
        "p1b": [
          -32,
          -32
        ],
        "p2a": [
          -32,
          0
        ],
        "p2b": [
          -32,
          64
        ],
        "sa": [
          32,
          -64
        ],
        "sb": [
          32,
          64
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
      "prefix": "TL",
      "name": "Transmission line",
      "pins": {
        "leftReturn": [
          -48,
          16
        ],
        "rightReturn": [
          48,
          16
        ],
        "left": [
          -48,
          -16
        ],
        "right": [
          48,
          -16
        ]
      },
      "parameters": {
        "delay": 0.001,
        "impedance": 75
      }
    },
    "counter": {
      "prefix": "U",
      "name": "Counter (4 bit)",
      "pins": {
        "clock": [
          -48,
          -48
        ],
        "reset": [
          -48,
          48
        ],
        "Q3": [
          48,
          -48
        ],
        "Q2": [
          48,
          -16
        ],
        "Q1": [
          48,
          16
        ],
        "Q0": [
          48,
          48
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
      "prefix": "U",
      "name": "Latch / register (4 bit)",
      "pins": {
        "I0": [
          -48,
          32
        ],
        "I1": [
          -48,
          0
        ],
        "I2": [
          -48,
          -32
        ],
        "I3": [
          -48,
          -64
        ],
        "O0": [
          48,
          32
        ],
        "O1": [
          48,
          0
        ],
        "O2": [
          48,
          -32
        ],
        "O3": [
          48,
          -64
        ],
        "load": [
          -48,
          64
        ]
      },
      "parameters": {
        "highVoltage": 5,
        "initialValue": 0,
        "edgeTriggered": true
      }
    },
    "halfAdder": {
      "prefix": "U",
      "name": "Half adder",
      "pins": {
        "sum": [
          48,
          -16
        ],
        "carry": [
          48,
          16
        ],
        "A": [
          -48,
          -16
        ],
        "B": [
          -48,
          16
        ]
      },
      "parameters": {
        "highVoltage": 5
      }
    },
    "fullAdder": {
      "prefix": "U",
      "name": "Adder (4 bit)",
      "pins": {
        "A0": [
          -48,
          -32
        ],
        "A1": [
          -48,
          -64
        ],
        "A2": [
          -48,
          -96
        ],
        "A3": [
          -48,
          -128
        ],
        "B0": [
          -48,
          96
        ],
        "B1": [
          -48,
          64
        ],
        "B2": [
          -48,
          32
        ],
        "B3": [
          -48,
          0
        ],
        "S0": [
          48,
          32
        ],
        "S1": [
          48,
          0
        ],
        "S2": [
          48,
          -32
        ],
        "S3": [
          48,
          -64
        ],
        "carryIn": [
          -48,
          128
        ],
        "carryOut": [
          48,
          -128
        ]
      },
      "parameters": {
        "highVoltage": 5
      }
    },
    "dFlipFlop": {
      "prefix": "U",
      "name": "D flip-flop",
      "pins": {
        "D": [
          -48,
          -16
        ],
        "clock": [
          -48,
          16
        ],
        "Q": [
          48,
          -16
        ],
        "Qn": [
          48,
          16
        ]
      },
      "parameters": {
        "highVoltage": 5,
        "initialState": false
      }
    },
    "jkFlipFlop": {
      "prefix": "U",
      "name": "JK flip-flop",
      "pins": {
        "J": [
          -48,
          -32
        ],
        "clock": [
          -48,
          0
        ],
        "K": [
          -48,
          32
        ],
        "Q": [
          48,
          -32
        ],
        "Qn": [
          48,
          32
        ]
      },
      "parameters": {
        "highVoltage": 5,
        "initialState": false,
        "positiveEdge": false
      }
    },
    "tFlipFlop": {
      "prefix": "U",
      "name": "T flip-flop",
      "pins": {
        "T": [
          -48,
          -16
        ],
        "clock": [
          -48,
          16
        ],
        "Q": [
          48,
          -16
        ],
        "Qn": [
          48,
          16
        ]
      },
      "parameters": {
        "highVoltage": 5,
        "initialState": false
      }
    },
    "capacitor": {
      "prefix": "C",
      "name": "Capacitor",
      "pins": {
        "a": [
          -24,
          0
        ],
        "b": [
          24,
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
      "prefix": "V",
      "name": "DC source (2 terminals)",
      "pins": {
        "p": [
          0,
          -48
        ],
        "n": [
          0,
          48
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
      "prefix": "V",
      "name": "DC source (1 terminal)",
      "pins": {
        "p": [
          0,
          32
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
      "prefix": "S",
      "name": "Switch",
      "pins": {
        "a": [
          -48,
          0
        ],
        "b": [
          48,
          0
        ]
      },
      "parameters": {
        "closed": true
      }
    },
    "opamp": {
      "prefix": "U",
      "name": "Op-amp",
      "pins": {
        "minus": [
          -48,
          -16
        ],
        "plus": [
          -48,
          16
        ],
        "out": [
          48,
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
          -32
        ]
      },
      "parameters": {}
    },
    "xnorGate": {
      "prefix": "U",
      "name": "XNOR gate",
      "pins": {
        "a": [
          -48,
          -16
        ],
        "b": [
          -48,
          16
        ],
        "out": [
          48,
          0
        ]
      },
      "parameters": {
        "highVoltage": 5
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
    ...Object.fromEntries(Object.entries(outputSpecs).map(([kind,spec])=>[kind,{prefix:spec.prefix,name:spec.name,pins:spec.pins,parameters:spec.parameters}])),
    ...basicDefinitions
  };
  const graphic=kind=>['text','box','line'].includes(kind);
  function validateOutput(component,timeStep){
    const spec=outputSpecs[component.kind],p=component.parameters,fields=Object.keys(spec.fields);
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
  const api=Object.freeze({grid:16,definitions,placementDefinitions,outputSpecs,graphic,validateOutput,validWaveform,waveformNames,simulationModels});

  registry.catalog=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})();
