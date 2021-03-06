{
  "name": "AND",
  "doc": {
    "de": {
      "description": "Wendet den binären UND-Operator auf die Werte der Register an.",
      "flags": {
        "z": "wird gesetzt wenn das Ergebnis 0 ist"
      }
    },
    "en": {
      "description": "Calucates the binary AND of the values of both registers.",
      "flags": {
        "z": "is set if the result is 0"
      }
    }
  },
  "tests": [
    {
      cmd: "AND b0,b1",
      setup: { reg: { "b0": "01010101", "b1": "01000011" } },
      steps: { reg: { "b0": "01000001" }, flags: { c: false, z: false } }
    },
    {
      cmd: "AND b0,b1",
      setup: { reg: { "b0": "11000000", "b1": "00000011" } },
      steps: { reg: { "b0": "00000000" }, flags: { c: false, z: true } }
    }
  ],
  "code": [
    {
      "value": 0x10
    },
    {
      "value": "000100",
      "length": 6
    }
  ],
  "params": [
    {
      "type": "r_byte"
    },
    {
      "type": "r_byte"
    }
  ],
  "checkFlags": { "z": true },
  "exec": function (rbyte1, rbyte2) {
    var newVal = rbyte1.value & rbyte2.value;
    this.writeByteRegister(rbyte1.address, newVal & 0xFF);
  }
}
