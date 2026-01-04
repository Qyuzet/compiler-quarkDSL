# QuarkDSL Hybrid Language Design

## 1. Core Concepts

### Domain Annotations

Functions can be annotated with their execution domain:

```rust
@gpu
fn matrix_multiply(a: [float], b: [float]) -> [float] {
    // Executes on GPU, generates WGSL
}

@quantum
fn apply_hadamard(qubits: [qubit]) -> [qubit] {
    // Executes on quantum computer, generates Qiskit
}

// No annotation = classical CPU
fn preprocess(data: [float]) -> [float] {
    // Executes on CPU
}
```

### Hybrid Workflows

Functions can call across domains - compiler handles conversions:

```rust
fn hybrid_pipeline(data: [float]) -> [float] {
    let features = gpu_extract(data);      // GPU
    let qstate = quantum_encode(features); // Auto: GPU → Quantum
    let result = quantum_vqe(qstate);      // Quantum
    let output = gpu_classify(result);     // Auto: Quantum → GPU
    return output;
}
```

## 2. Type System Extensions

### New Types

- `tensor<T>` - GPU tensor (WGSL buffer)
- `qstate` - Quantum state (Qiskit QuantumCircuit)
- `qubit` - Single qubit reference

### Type Compatibility

```rust
// Explicit conversions
let gpu_data: tensor<float> = [1.0, 2.0, 3.0];
let qstate: qstate = to_quantum(gpu_data);  // GPU → Quantum
let result: tensor<float> = to_gpu(qstate); // Quantum → GPU

// Implicit conversions (when calling across domains)
@quantum
fn quantum_op(q: qstate) -> qstate { ... }

@gpu
fn gpu_op(t: tensor<float>) -> tensor<float> { ... }

fn hybrid() {
    let t = gpu_op([1.0, 2.0]);
    let q = quantum_op(t);  // Compiler inserts: to_quantum(t)
    let result = gpu_op(q); // Compiler inserts: to_gpu(q)
}
```

## 3. Standard Library

### GPU Operations (WGSL backend)

```rust
@gpu fn matmul(a: tensor<float>, b: tensor<float>) -> tensor<float>
@gpu fn softmax(x: tensor<float>) -> tensor<float>
@gpu fn relu(x: tensor<float>) -> tensor<float>
@gpu fn reduce_sum(x: tensor<float>) -> float
```

### Quantum Operations (Qiskit backend)

```rust
@quantum fn h(q: qubit) -> qubit           // Hadamard
@quantum fn cx(ctrl: qubit, targ: qubit)   // CNOT
@quantum fn ry(q: qubit, theta: float)     // RY rotation
@quantum fn measure(q: qubit) -> int       // Measurement
```

### Hybrid Algorithms

```rust
// Variational Quantum Eigensolver
fn vqe(hamiltonian: tensor<float>, ansatz: fn(tensor<float>) -> qstate) -> float {
    let params = init_params_gpu();
    for i in 0..100 {
        let energy = vqe_step(params, hamiltonian, ansatz);
        params = adam_update_gpu(params, energy);
    }
    return energy;
}

// Quantum Approximate Optimization Algorithm
fn qaoa(cost_hamiltonian: tensor<float>, layers: int) -> tensor<float> {
    let params = init_params_gpu();
    for i in 0..100 {
        let cost = qaoa_step(params, cost_hamiltonian, layers);
        params = optimize_gpu(params, cost);
    }
    return params;
}
```

## 4. Example: VQE (Variational Quantum Eigensolver)

### QuarkDSL Code

```rust
@quantum
fn ansatz(params: [float], qubits: [qubit]) -> [qubit] {
    for i in 0..len(qubits) {
        ry(qubits[i], params[i]);
    }
    for i in 0..len(qubits)-1 {
        cx(qubits[i], qubits[i+1]);
    }
    return qubits;
}

@quantum
fn measure_energy(qubits: [qubit], hamiltonian: [float]) -> float {
    let counts = measure_all(qubits);
    return expectation_value(counts, hamiltonian);
}

@gpu
fn optimize_params(params: tensor<float>, gradient: tensor<float>) -> tensor<float> {
    let lr = 0.01;
    return params - lr * gradient;
}

fn vqe_main() -> tensor<float> {
    // Initialize on GPU
    let params = init_random_gpu(4);
    let hamiltonian = [1.0, 0.5, 0.5, 1.0];
    
    // Optimization loop
    for iter in 0..100 {
        // GPU → Quantum (automatic)
        let qubits = ansatz(params, [q0, q1, q2, q3]);
        
        // Quantum execution
        let energy = measure_energy(qubits, hamiltonian);
        
        // Quantum → GPU (automatic)
        let grad = compute_gradient_gpu(energy);
        
        // GPU optimization
        params = optimize_params(params, grad);
    }
    
    return params;
}
```

### Generated Code (Hybrid Orchestration)

```python
import torch
from qiskit import QuantumCircuit, execute

def vqe_main():
    # GPU initialization
    params = torch.randn(4).cuda()
    hamiltonian = torch.tensor([1.0, 0.5, 0.5, 1.0]).cuda()
    
    for iter in range(100):
        # AUTO: GPU → Quantum conversion
        params_cpu = params.cpu().numpy()
        
        # Quantum execution
        circuit = QuantumCircuit(4)
        for i in range(4):
            circuit.ry(params_cpu[i], i)
        for i in range(3):
            circuit.cx(i, i+1)
        
        result = execute(circuit, backend).result()
        energy_cpu = compute_expectation(result, hamiltonian.cpu().numpy())
        
        # AUTO: Quantum → GPU conversion
        energy = torch.tensor(energy_cpu).cuda()
        
        # GPU optimization
        grad = torch.autograd.grad(energy, params)[0]
        params = params - 0.01 * grad
    
    return params
```

## 5. Compilation Strategy

### Domain Detection

1. Parse `@gpu` and `@quantum` annotations
2. Build call graph with domain information
3. Detect cross-domain calls
4. Insert conversion nodes in IR

### Code Generation

1. **GPU functions** → Generate WGSL compute shaders
2. **Quantum functions** → Generate Qiskit circuits
3. **Hybrid orchestrator** → Generate Python glue code with:
   - GPU execution (via WebGPU or PyTorch)
   - Quantum execution (via Qiskit)
   - Automatic data marshalling

### Optimization

1. **Fusion**: Combine consecutive GPU operations
2. **Batching**: Batch multiple quantum circuits
3. **Caching**: Cache conversion results when possible
4. **Pipelining**: Overlap GPU and Quantum execution

## 6. Next Steps

1. Extend lexer with `@gpu`, `@quantum` tokens
2. Extend parser with annotation support
3. Add `tensor<T>` and `qstate` types to AST
4. Extend type checker for cross-domain calls
5. Extend IR with domain markers
6. Implement hybrid code generation

