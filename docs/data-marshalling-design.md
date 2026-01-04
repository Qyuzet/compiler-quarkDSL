# Data Marshalling Design - QuarkDSL

**Purpose:** Automatic conversion between GPU and Quantum domains

---

## 🎯 Problem Statement

When calling across domains, we need to convert data:

```rust
@gpu
fn preprocess(data: [float]) -> [float] { ... }

@quantum
fn quantum_circuit(params: [float]) -> int { ... }

fn main() {
    let features = preprocess(data);      // GPU: [float]
    let result = quantum_circuit(features); // Need: GPU → Quantum conversion!
}
```

**Challenge:** GPU arrays ≠ Quantum states

---

## 📊 Data Type Mapping

| QuarkDSL Type   | GPU (WGSL)   | Quantum (Qiskit)   | Conversion Method   |
| --------------- | ------------ | ------------------ | ------------------- |
| `[float]`       | `array<f32>` | Angle encoding     | `ry(qubit, angle)`  |
| `[int]`         | `array<i32>` | Basis encoding     | `x(qubit)` if bit=1 |
| `tensor<float>` | `array<f32>` | Amplitude encoding | Statevector         |
| `qstate`        | N/A          | `QuantumCircuit`   | Direct              |
| `int` (result)  | `i32`        | Measurement        | `measure()`         |

---

## 🔄 Conversion Strategies

### **1. GPU → Quantum: Angle Encoding** (Default)

**Use case:** Encode classical features into quantum states

**Method:** Each float value → rotation angle on qubit

```python
# GPU output: [0.5, 0.3, 0.7, 0.2]
# Quantum encoding:
circuit.ry(0.5, qr[0])  # qubit 0 ← 0.5
circuit.ry(0.3, qr[1])  # qubit 1 ← 0.3
circuit.ry(0.7, qr[2])  # qubit 2 ← 0.7
circuit.ry(0.2, qr[3])  # qubit 3 ← 0.2
```

**Pros:**

- ✅ Simple and efficient
- ✅ Works for any float values
- ✅ Common in VQE/QAOA

**Cons:**

- ⚠️ Requires N qubits for N values

---

### **2. GPU → Quantum: Amplitude Encoding**

**Use case:** Encode large vectors efficiently

**Method:** Encode N values into √N qubits using amplitudes

```python
# GPU output: [0.5, 0.5, 0.5, 0.5]  # 4 values
# Quantum encoding: 2 qubits (2^2 = 4 amplitudes)
circuit.initialize([0.5, 0.5, 0.5, 0.5], qr)
```

**Pros:**

- ✅ Exponentially efficient (N values → log₂(N) qubits)
- ✅ Good for large datasets

**Cons:**

- ⚠️ Requires normalization (sum of squares = 1)
- ⚠️ More complex

---

### **3. Quantum → GPU: Measurement Extraction**

**Use case:** Get quantum results back to classical

**Method:** Measure qubits → extract counts → convert to array

```python
# Quantum measurement
circuit.measure(qr, cr)
job = backend.run(circuit, shots=1024)
counts = job.result().get_counts()

# Extract to GPU array
# counts = {'00': 512, '01': 256, '10': 128, '11': 128}
# → [512, 256, 128, 128]
```

**Pros:**

- ✅ Standard quantum workflow
- ✅ Preserves probabilistic nature

**Cons:**

- ⚠️ Requires multiple shots
- ⚠️ Lossy (quantum → classical)

---

## 🏗️ Implementation Strategy

### **Phase 5A: Detect Cross-Domain Calls** ✅ (Already done!)

We already detect cross-domain calls in typecheck:

```
INFO: Cross-domain call from Classical to Gpu function 'gpu_matmul'
INFO: Cross-domain call from Classical to Quantum function 'quantum_encode'
```

### **Phase 5B: Generate Conversion Code**

**In IR lowering (`src/middle/lower.rs`):**

When we see a cross-domain call, insert conversion instructions:

```rust
// Before (current):
%4 = call quantum_encode(%3)

// After (with conversion):
%3_converted = gpu_to_quantum(%3)  // NEW: Conversion instruction
%4 = call quantum_encode(%3_converted)
```

### **Phase 5C: Backend Code Generation**

**GPU Backend (`src/backend/wgsl.rs`):**

- Generate WGSL compute shader
- Export results to buffer
- Return to Python orchestrator

**Quantum Backend (`src/backend/quantum.rs`):**

- Generate Qiskit circuit
- Add encoding gates (ry, initialize)
- Add measurement
- Return to Python orchestrator

**Python Orchestrator (NEW: `src/backend/orchestrator.rs`):**

- Generate Python script that:
  1. Runs GPU code (WebGPU)
  2. Extracts GPU results
  3. Encodes into quantum circuit
  4. Runs quantum code (Qiskit)
  5. Extracts quantum results
  6. Returns final result

---

## 📝 Example: Full Pipeline

### **QuarkDSL Code:**

```rust
@gpu
fn preprocess(data: [float]) -> [float] {
    let result = [0.0, 0.0, 0.0, 0.0];
    for i in 0..4 {
        result[i] = data[i] * 2.0;
    }
    return result;
}

@quantum
fn quantum_process(params: [float]) -> int {
    ry(0, params[0]);
    ry(1, params[1]);
    cx(0, 1);
    return measure(0);
}

fn main() -> int {
    let data = [0.5, 0.3, 0.7, 0.2];
    let features = preprocess(data);        // GPU
    let result = quantum_process(features); // GPU → Quantum
    return result;
}
```

### **Generated Python Orchestrator:**

```python
import numpy as np
from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister
from qiskit_ibm_runtime import QiskitRuntimeService

# Step 1: Run GPU code
def preprocess_gpu(data):
    # WGSL shader execution (WebGPU)
    result = data * 2.0  # Simplified
    return result

# Step 2: GPU → Quantum conversion
def encode_to_quantum(params):
    qr = QuantumRegister(2, 'q')
    cr = ClassicalRegister(2, 'c')
    circuit = QuantumCircuit(qr, cr)

    # Angle encoding
    circuit.ry(params[0], qr[0])
    circuit.ry(params[1], qr[1])
    circuit.cx(qr[0], qr[1])
    circuit.measure(qr[0], cr[0])

    return circuit

# Step 3: Run quantum code
def quantum_process(circuit):
    service = QiskitRuntimeService()
    backend = service.backend("ibm_brisbane")
    job = backend.run(circuit, shots=1024)
    counts = job.result().get_counts()

    # Extract result (most common measurement)
    result = int(max(counts, key=counts.get)[0])
    return result

# Main orchestration
def main():
    data = np.array([0.5, 0.3, 0.7, 0.2])

    # GPU execution
    features = preprocess_gpu(data)

    # Quantum execution
    circuit = encode_to_quantum(features)
    result = quantum_process(circuit)

    return result

if __name__ == "__main__":
    print(main())
```

---

## Implementation Status

All phases are complete:

1. **Phase 5A:** Detect cross-domain calls - COMPLETE
2. **Phase 5B:** Add conversion IR instructions - COMPLETE
3. **Phase 5C:** Generate conversion code in backends - COMPLETE
4. **Phase 5D:** Generate Python orchestrator - COMPLETE
5. **Phase 5E:** Test end-to-end - COMPLETE
6. **Phase 6:** TypeScript VM with quantum simulation - COMPLETE

### TypeScript VM Implementation

The TypeScript VM provides an alternative execution path with built-in quantum simulation:

- Stack-based bytecode interpreter
- 8-qubit quantum state vector simulator
- Quantum gates: H, X, Y, Z, RX, RY, RZ, CNOT, SWAP, Toffoli
- Probabilistic measurement with state collapse
- Web playground for interactive development

See `quarkdsl-web/lib/vm/` for implementation details.
