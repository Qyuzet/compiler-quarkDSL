# QuarkDSL Operational Guide

This document provides instructions for running the QuarkDSL compiler both from the command line and through the web interface.

## Prerequisites

- **Rust toolchain** (version 1.70 or later) for CLI compiler
- **Node.js** (version 18 or later) for web interface
- **npm** or **pnpm** for package management

## CLI Compiler

### Building the Compiler

```powershell
# Navigate to project root
cd quarkDSL

# Build release version
cargo build --release
```

The compiled binary will be located at `target/release/quarkdsl.exe` (Windows) or `target/release/quarkdsl` (Linux/macOS).

### Compile Commands

#### Compile to WGSL (WebGPU Shaders)

```powershell
.\target\release\quarkdsl compile examples\simple_gpu.tgpu -t wgsl
```

#### Compile to Quantum (Qiskit Python)

```powershell
.\target\release\quarkdsl compile examples\bell_state.tgpu -t quantum
```

#### Compile to Orchestrator (Hybrid Python)

```powershell
.\target\release\quarkdsl compile examples\hybrid_vqe.tgpu -t orchestrator
```

#### Save Output to File

```powershell
.\target\release\quarkdsl compile examples\bell_state.tgpu -t quantum -o output.py
```

#### Enable Optimizations

```powershell
.\target\release\quarkdsl compile examples\bell_state.tgpu -t wgsl -O
```

#### Dump Intermediate Representation

```powershell
.\target\release\quarkdsl compile examples\bell_state.tgpu -t wgsl --dump-ir
```

### Parse and Dump AST

```powershell
.\target\release\quarkdsl parse examples\bell_state.tgpu
```

### Lower to IR

```powershell
# Without optimizations
.\target\release\quarkdsl lower examples\bell_state.tgpu

# With optimizations
.\target\release\quarkdsl lower examples\bell_state.tgpu -O
```

### Available Targets

| Target | Description | Output |
|--------|-------------|--------|
| `wgsl` | WebGPU Shading Language | GPU compute shaders |
| `quantum` | Qiskit Python | Quantum circuit code |
| `orchestrator` | Hybrid Python | GPU + Quantum orchestration |

### Example Files

Located in the `examples/` directory:

- `simple_array.tgpu` - Basic array operations
- `simple_gpu.tgpu` - GPU compute example
- `bell_state.tgpu` - Quantum Bell state preparation
- `hybrid_simple.tgpu` - Simple hybrid program
- `hybrid_vqe.tgpu` - Variational Quantum Eigensolver
- `test_loop.tgpu` - Loop constructs

## Web Interface

### Starting the Development Server

```powershell
# Navigate to web directory
cd quarkdsl-web

# Install dependencies (first time only)
npm install

# Start development server
npm run dev
```

### Accessing the Web Interface

Once the server is running, open your browser and navigate to:

```
http://localhost:3000
```

### Web Interface Features

- **Source Editor** - Write QuarkDSL code with syntax highlighting
- **Output Tabs** - View generated code for each backend (WGSL, Qiskit, Hybrid, VM)
- **Execution Panel** - Run programs through the integrated virtual machine
- **Quantum State Visualizer** - View quantum state probabilities and phases

### Building for Production

```powershell
cd quarkdsl-web

# Build production bundle
npm run build

# Start production server
npm run start
```

### Live Deployment

The online compiler is also available at:

```
https://www.quarkdsl.com/
```

## Quick Start

### CLI Quick Test

```powershell
cargo build --release
.\target\release\quarkdsl compile examples\simple_array.tgpu -t wgsl
```

### Web Quick Test

```powershell
cd quarkdsl-web
npm install
npm run dev
# Open http://localhost:3000 in browser
```

