# IBM Quantum Hardware Integration

QuarkDSL supports execution on real IBM Quantum hardware.

---

## Configuration

### Generated Code Configuration

All generated Python code includes a configuration flag:

```python
USE_QUANTUM_COMPUTER = False  # Set to True to use IBM Quantum hardware
IBM_API_KEY = "krPjNWz0BsR_PSI0UVVG_VxIFSA27a5SaEgpLlI22-F-"
```

### Switching Between Simulator and Hardware

| Mode | Configuration | Execution |
|------|---------------|-----------|
| **Simulator** (default) | `USE_QUANTUM_COMPUTER = False` | Local Qiskit Aer simulator |
| **IBM Quantum Hardware** | `USE_QUANTUM_COMPUTER = True` | Real IBM Quantum computer |

---

## Usage

### Step 1: Compile QuarkDSL Code

```bash
cargo run -- compile examples/hybrid.tgpu -t orchestrator -o demo.py
```

### Step 2: Edit Configuration (Optional)

Open `demo.py` and set:

```python
USE_QUANTUM_COMPUTER = True  # Enable IBM Quantum hardware
```

### Step 3: Install Dependencies

```bash
pip install qiskit qiskit-ibm-runtime qiskit-aer numpy
```

### Step 4: Run

#### Using Simulator (default)

```bash
python demo.py
```

Output:
```
Using local Qiskit Aer simulator
Counts: {'00': 512, '11': 512}
Result: 0
```

#### Using IBM Quantum Hardware

```bash
python demo.py
```

Output:
```
Connecting to IBM Quantum...
Using IBM Quantum backend: ibm_brisbane
Job ID: abc123xyz
Waiting for results...
Counts: {'00': 498, '11': 526}
Result: 3
```

---

## How It Works

### Simulator Mode (`USE_QUANTUM_COMPUTER = False`)

```python
def run_quantum_circuit(circuit, shots=1024):
    print("Using local Qiskit Aer simulator")
    simulator = AerSimulator()
    job = simulator.run(circuit, shots=shots)
    result = job.result()
    counts = result.get_counts()
    return counts
```

### Hardware Mode (`USE_QUANTUM_COMPUTER = True`)

```python
def run_quantum_circuit(circuit, shots=1024):
    service = QiskitRuntimeService(channel="ibm_quantum", token=IBM_API_KEY)
    backend = service.least_busy(operational=True, simulator=False)
    print(f"Using IBM Quantum backend: {backend.name}")
    
    sampler = Sampler(backend)
    job = sampler.run([circuit], shots=shots)
    result = job.result()
    
    pub_result = result[0]
    counts_dict = pub_result.data.meas.get_counts()
    return counts_dict
```

---

## Backend Selection

### Automatic Selection

The code automatically selects the least busy IBM Quantum backend:

```python
backend = service.least_busy(operational=True, simulator=False)
```

### Manual Backend Selection (Advanced)

Edit generated code to specify a backend:

```python
backend = service.backend("ibm_brisbane")  # Specific backend
```

---

## API Key Management

### Current Setup

API key is embedded in generated code:

```python
IBM_API_KEY = "krPjNWz0BsR_PSI0UVVG_VxIFSA27a5SaEgpLlI22-F-"
```

### Best Practice (Production)

Use environment variables:

```python
import os
IBM_API_KEY = os.getenv("IBM_QUANTUM_API_KEY", "your-key-here")
```

Set environment variable:

```bash
export IBM_QUANTUM_API_KEY="krPjNWz0BsR_PSI0UVVG_VxIFSA27a5SaEgpLlI22-F-"
python demo.py
```

---

## Execution Time

| Mode | Typical Time |
|------|--------------|
| Simulator | < 1 second |
| IBM Quantum Hardware | 1-10 minutes (queue time + execution) |

---

## Troubleshooting

### Error: Invalid API Key

```
IBMAccountError: Invalid token
```

**Solution:** Verify API key in generated code.

### Error: No Backend Available

```
QiskitBackendNotFoundError: No backend found
```

**Solution:** Check IBM Quantum account has access to backends.

### Error: Job Failed

```
RuntimeJobFailureError: Job failed
```

**Solution:** Check circuit is compatible with hardware (gate set, qubit count).

---

## Example Output Comparison

### Simulator Output

```
Using local Qiskit Aer simulator
Counts: {'00': 512, '11': 512}
```

### Hardware Output

```
Connecting to IBM Quantum...
Using IBM Quantum backend: ibm_brisbane
Job ID: abc123xyz456
Waiting for results...
Counts: {'00': 498, '01': 13, '10': 15, '11': 498}
```

Note: Hardware results include noise and errors.

---

## Supported Backends

All generated code works with:

- Qiskit Aer (simulator)
- IBM Quantum hardware (127+ qubit systems)
- IBM Quantum simulators (cloud-based)

---

## Notes

- Hardware execution requires valid IBM Quantum account
- Queue times vary based on backend availability
- Hardware results include quantum noise
- Simulator results are ideal (no noise)

