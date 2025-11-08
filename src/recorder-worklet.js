class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(inputs, outputs, parameters) {
    // inputs[0][0] is the first channel of the first input node
    const input = inputs[0];
    if (input && input[0]) {
      // Send the first channel's Float32Array to the main thread
      this.port.postMessage(input[0]);
    }
    // Keep processor alive
    return true;
  }
}

registerProcessor('recorder-processor', RecorderProcessor);
