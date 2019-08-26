'use strict';

module.exports = [{
  device: {
    plutoSdrInputSettings: {
      centerFrequency: 144000000,
      transverterMode: 0,
      devSampleRate: 2083336,
      lpfBW: 200000,
      log2Decim: 3,
      gainMode: 0,
      gain: 70
    }
  },
  channel: {
    SSBDemodSettings: {
      agc: 1,
      volume: 5,
      reverseAPIPort: 8000,
      useReverseAPI: 1
    }
  }
}, {
  device: {
    plutoSdrOutputSettings: {
      centerFrequency: 432000000,
      transverterMode: 0,
      devSampleRate: 2083336,
      lpfBW: 200000,
      log2Interp: 3,
      att: 0
    },
    channel: {
      SSBModSettings: {
        modAFInput: 1
      }
    }
  }
}];
