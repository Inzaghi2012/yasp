{
  "name": "RL",
  "doc": {
    "de": {
      "description": "Shiftet das register um ein Bit nach links in das Carry-Flag, z.B.: 00000010 10000000 => 00000101 00000000",
      "flags": {
        "c": "wird gesetzt wenn das höchstwertigste Bit des Wertes 1 war"
      }
    },
    "en": {
      "description": "Shifts the register by one bit to the left into the carry bit, e.g. 00000010 10000000 => 00000101 00000000",
      "flags": {
        "c": "is set if the most-significant bit of the value was 1"
      }
    }
  },
  "tests": [
    {
      cmd: "RL w0",
      setup: { reg: { "w0": "01111111 10101010" } },
      steps: { reg: { "w0": "11111111 01010100" }, flags: { c: false, z: false } }
    },
    {
      cmd: "RL w0",
      setup: { reg: { "w0": "11111111 10101010" } },
      steps: { reg: { "w0": "11111111 01010100" }, flags: { c: true, z: false } }
    }
  ],
  "code": [
    {
      "value": 0x60
    },
    {
      "value": "101",
      "length": 3
    }
  ],
  "params": [
    {
      "type": "r_word"
    }
  ],
  "exec": function (rbyte1) {
    var oldVal = rbyte1.value;
    var newVal = (oldVal << 1) & 0xFFFF;
  
    this.writeWordRegister(rbyte1.address, newVal);
    this.writeFlags(!!(oldVal &  0x8000), null);
  }
}
