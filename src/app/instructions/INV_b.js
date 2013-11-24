{
  "name": "INV",
  "doc": {
    "de": {
      "description": "Berechnet das Einser-Kompliment des angegebenen registers.",
      "flags": {
        "z": "wird gesetzt wenn das Ergebnis 0 ist"
      }
    },
    "en": {
      "description": "Calculates the 1's complement of the specified register.",
      "flags": {
        "z": "is set if the result is 0"
      }
    }
  },
  "code": [
    {
      "value": 0x40
    },
    {
      "value": "010",
      "length": 3
    }
  ],
  "params": [
    {
      "type": "r_byte"
    }
  ],
  "checkFlags": { "z": true },
  "exec": function (rbyte1) {
    var newVal = (~rbyte1.value) & 0xFF;
    this.writeByteRegister(rbyte1.address, newVal);
  }
}
