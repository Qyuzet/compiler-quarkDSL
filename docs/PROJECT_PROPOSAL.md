# QuarkDSL Project Proposal

**Course:** COMP6062001 – Compilation Techniques  
**Project:** QuarkDSL - Unified Hybrid Quantum-Classical Compiler  
**Week:** 10 Milestone Submission  
**Date:** [Insert Date]

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Problem Statement](#2-problem-statement)
3. [Proposed Solution](#3-proposed-solution)
4. [Language Design](#4-language-design)
5. [Compiler Architecture](#5-compiler-architecture)
6. [Implementation Details](#6-implementation-details)
7. [Progress Report](#7-progress-report)
8. [Challenges & Solutions](#8-challenges--solutions)
9. [Timeline & Next Steps](#9-timeline--next-steps)
10. [References](#10-references)

---

## 1. Introduction

### 1.1 Background

Quantum computing is emerging as a powerful paradigm for solving complex computational problems. However, practical quantum algorithms often require hybrid workflows that combine:
- **Classical preprocessing** (data preparation, feature extraction)
- **Quantum computation** (quantum algorithms, circuit execution)
- **Classical postprocessing** (result analysis, optimization)

Current tools require developers to manually orchestrate these workflows using multiple frameworks (PyTorch, Qiskit, NumPy), leading to:
- Manual data conversion between frameworks
- Error-prone boilerplate code
- No cross-domain optimization
- Steep learning curve

### 1.2 Motivation

QuarkDSL addresses this problem by providing a **unified language** for hybrid quantum-classical programming with:
- Domain annotations for execution targeting
- Automatic data marshalling between GPU and quantum domains
- Cross-domain type checking
- Multi-backend code generation

This project demonstrates advanced compiler techniques while solving a real research problem in quantum computing.

---

## 2. Problem Statement

### 2.1 Current Approach

Hybrid quantum-classical workflows currently require:

```python
# Example: Manual hybrid workflow
import torch
from qiskit import QuantumCircuit, execute, Aer

# 1. GPU preprocessing
data = torch.randn(100).cuda()
features = neural_network(data)

# 2. Manual conversion - TEDIOUS!
features_cpu = features.cpu().numpy()

# 3. Quantum encoding - MANUAL!
circuit = QuantumCircuit(4)
for i, val in enumerate(features_cpu[:4]):
    circuit.ry(val, i)
circuit.cx(0, 1)

# 4. Execution
backend = Aer.get_backend('qasm_simulator')
job = execute(circuit, backend, shots=1024)
result = job.result()

# 5. Manual extraction - TEDIOUS!
counts = result.get_counts()
output = int(max(counts, key=counts.get), 2)
```

**Problems:**
- 50+ lines of boilerplate
- 3+ frameworks required
- Manual type conversions
- Error-prone
- No optimization across domains

### 2.2 Research Gap

No existing compiler provides:
- Unified syntax for GPU + Quantum
- Automatic data marshalling at compile time
- Cross-domain optimization
- Type-safe hybrid workflows

---

## 3. Proposed Solution

### 3.1 QuarkDSL Language

QuarkDSL provides a unified language with domain annotations:

```rust
@gpu
fn preprocess(data: [float]) -> [float] {
    // GPU computation
    let result = [0.0, 0.0, 0.0, 0.0];
    for i in 0..4 {
        result[i] = data[i] * 2.0;
    }
    return result;
}

@quantum
fn quantum_encode(features: [float]) -> int {
    // Quantum computation
    ry(0, features[0]);
    ry(1, features[1]);
    cx(0, 1);
    return measure(0);
}

fn main() -> int {
    let data = [1.0, 2.0, 3.0, 4.0];
    let features = preprocess(data);      // GPU
    let result = quantum_encode(features); // Quantum (AUTO-CONVERSION!)
    return result;
}
```

**Benefits:**
- 10 lines vs 50+ lines
- Single language
- Automatic conversions
- Type-safe
- Optimizable

### 3.2 Key Features

1. **Domain Annotations:** `@gpu`, `@quantum` for execution targeting
2. **Automatic Data Marshalling:** Compiler inserts conversions automatically
3. **Cross-Domain Type Checking:** Validates types across domains
4. **Multi-Backend Code Generation:** WGSL (GPU), Qiskit (Quantum), Python (Orchestrator)
5. **Executable Output:** Generates working Python code

---

## 4. Language Design

### 4.1 Type System

| Type | Domain | Description |
|------|--------|-------------|
| `int` | All | 32-bit integer |
| `float` | All | 64-bit floating point |
| `bool` | All | Boolean |
| `[T]` | All | Array of type T |
| `tensor<T>` | GPU | GPU tensor |
| `qstate` | Quantum | Quantum state |
| `qubit` | Quantum | Single qubit (internal) |

### 4.2 Grammar (EBNF)

```ebnf
program     ::= function*
function    ::= domain? "fn" IDENT "(" params ")" "->" type block
domain      ::= "@gpu" | "@quantum"
params      ::= (param ("," param)*)?
param       ::= IDENT ":" type
type        ::= "int" | "float" | "bool" | "void" | "[" type "]" 
              | "tensor" "<" type ">" | "qstate"
block       ::= "{" statement* "}"
statement   ::= let_stmt | if_stmt | for_stmt | return_stmt | expr_stmt
let_stmt    ::= "let" IDENT "=" expression ";"
if_stmt     ::= "if" expression block ("else" block)?
for_stmt    ::= "for" IDENT "in" expression ".." expression block
return_stmt ::= "return" expression ";"
expr_stmt   ::= expression ";"
expression  ::= binary_op | call | array_index | literal | IDENT
binary_op   ::= expression ("+" | "-" | "*" | "/" | "==" | "<" | ">") expression
call        ::= IDENT "(" args ")"
array_index ::= expression "[" expression "]"
literal     ::= INT | FLOAT | BOOL | array_literal
array_literal ::= "[" (expression ("," expression)*)? "]"
```

### 4.3 Lexer Tokens

```rust
// Domain annotations
@gpu, @quantum

// Keywords
fn, let, if, else, for, in, return

// Types
int, float, bool, void, tensor, qstate

// Operators
+, -, *, /, ==, <, >, =, ;, :, ,, ->, .., [, ], {, }, (, )

// Literals
INT, FLOAT, BOOL, IDENT
```

---

## 5. Compiler Architecture

### 5.1 Pipeline Overview

```
QuarkDSL Source (.tgpu)
    ↓
Lexer (logos) - Tokenization
    ↓
Parser (Recursive Descent) - AST Generation
    ↓
Type Checker - Cross-domain validation
    ↓
IR Lowering (SSA) - Automatic conversion insertion
    ↓
Optimization (DCE, CSE)
    ↓
Code Generation
    ├── WGSL (GPU)
    ├── Qiskit (Quantum)
    └── Python Orchestrator (Hybrid)
```

### 5.2 Parsing Algorithm

**Algorithm:** Recursive Descent (LL(1))

**Rationale:**
- Simple to implement and understand
- Efficient for our grammar (no left recursion)
- Easy to extend with new features
- Good error messages
- Suitable for hand-written parsers

**Complexity:** O(n) where n is the number of tokens

### 5.3 IR Design

**SSA-Based Intermediate Representation:**

```
fn hybrid_pipeline(input: [float]) -> int {
  entry:
    %0 = input                                    // Parameter
    %1 = [1, 2, 3, 4]                            // Constant
    %2 = convert_Classical_to_Gpu(%0, AngleEncoding)  // AUTO!
    %3 = convert_Classical_to_Gpu(%1, AngleEncoding)  // AUTO!
    %4 = call gpu_matmul(%2, %3)                 // GPU call
    %5 = %4                                       // Assignment
    %6 = convert_Classical_to_Quantum(%5, AngleEncoding) // AUTO!
    %7 = call quantum_encode(%6)                 // Quantum call
    return %7
}
```

**Key Features:**
- Static Single Assignment (SSA) form
- Domain markers (@gpu, @quantum)
- DomainConversion instruction (automatic!)
- Type information preserved

---

## 6. Implementation Details

### 6.1 Technology Stack

- **Language:** Rust (for compiler implementation)
- **Lexer:** logos library (regex-based tokenization)
- **Parser:** Hand-written recursive descent
- **IR:** Custom SSA-based representation
- **Backends:** WGSL, Qiskit (Python), Python orchestrator

### 6.2 Data Structures

**AST Node:**
```rust
pub struct Function {
    pub name: String,
    pub domain: Domain,  // Classical, Gpu, Quantum
    pub params: Vec<Parameter>,
    pub return_type: Type,
    pub body: Block,
}
```

**IR Instruction:**
```rust
pub enum Instruction {
    Assign { dest: SSAVar, value: Value },
    BinaryOp { dest: SSAVar, op: BinOp, left: Value, right: Value },
    Call { dest: Option<SSAVar>, function: String, args: Vec<Value> },
    DomainConversion {
        dest: SSAVar,
        source: Value,
        from_domain: Domain,
        to_domain: Domain,
        encoding: ConversionEncoding,
    },
    // ... more instructions
}
```

### 6.3 Automatic Conversion Insertion

**Algorithm:**
1. **First Pass:** Collect all function domains into HashMap
2. **Second Pass:** Lower AST to IR
   - For each function call:
     - Check if target domain differs from current domain
     - If yes, insert DomainConversion instruction
     - Skip for built-in quantum functions (h, ry, cx, etc.)

**Complexity:** O(n) where n is the number of AST nodes

---

## 7. Progress Report

### 7.1 Completed Phases

✅ **Phase 1: Design (100%)**
- Hybrid language design
- Domain annotations syntax
- Type system design
- Data marshalling strategy

✅ **Phase 2: Frontend (100%)**
- Lexer with domain tokens
- Recursive descent parser
- AST with domain markers
- Error handling

✅ **Phase 3: Type System (100%)**
- Cross-domain call detection
- Type compatibility rules
- Built-in quantum functions

✅ **Phase 4: IR & Optimization (100%)**
- SSA-based IR
- Automatic conversion insertion
- Dead Code Elimination (DCE)
- Common Subexpression Elimination (CSE)

✅ **Phase 5: Code Generation (100%)**
- WGSL backend (GPU compute shaders)
- Qiskit backend (quantum circuits)
- Python orchestrator backend (hybrid execution)

### 7.2 Statistics

- **Total Lines of Code:** ~3,500
- **Rust Code:** ~2,800 lines
- **Documentation:** ~700 lines
- **Build Status:** ✅ 0 errors, 0 warnings
- **Test Status:** ✅ All tests passing

### 7.3 Test Results

```
✅ Build: PASS
✅ Parse: PASS (all examples)
✅ Lower: PASS (IR generation with auto-conversions)
✅ WGSL Backend: PASS
✅ Quantum Backend: PASS
✅ Orchestrator Backend: PASS
✅ VQE Example: PASS (complex hybrid workflow)
✅ Python Execution: PASS
```

---

## 8. Challenges & Solutions

### 8.1 Challenge 1: Cross-Domain Type Checking

**Problem:** How to validate types across GPU/Quantum boundaries?

**Solution:** Extended type checker with domain-aware rules:
- Track function domains in symbol table
- Validate cross-domain calls
- Ensure type compatibility for conversions

### 8.2 Challenge 2: Automatic Conversion Insertion

**Problem:** When and where to insert conversions?

**Solution:** Two-pass IR lowering:
1. First pass: Collect all function domains
2. Second pass: Insert conversions at domain boundaries

### 8.3 Challenge 3: Multi-Backend Code Generation

**Problem:** Single IR → 3 different output languages

**Solution:** Modular backend architecture:
- Shared IR representation
- Backend-specific code generators
- Common helper functions

### 8.4 Challenge 4: Data Marshalling Strategies

**Problem:** How to convert GPU tensors ↔ Quantum states?

**Solution:** Multiple encoding strategies:
- **Angle Encoding:** Classical float → Quantum rotation (ry gate)
- **Amplitude Encoding:** Classical vector → Quantum statevector
- **Measurement Extraction:** Quantum counts → Classical int

---

## 9. Timeline & Next Steps

### 9.1 Remaining Work (Week 11-12)

- [ ] Standard library for common patterns (VQE, QAOA)
- [ ] Enhanced error messages with line numbers
- [ ] More optimization passes (constant folding, loop unrolling)
- [ ] Documentation improvements

### 9.2 Final Deliverables (Week 13)

- [ ] Final presentation slides
- [ ] Project report (max 20 pages)
- [ ] Demo video (5 minutes)
- [ ] GitHub repository
- [ ] Live demo

### 9.3 Current Status

**Overall Progress:** 95% Complete  
**Confidence Level:** HIGH ✅

---

## 10. References

1. Qiskit Documentation: https://qiskit.org/documentation/
2. WebGPU Specification: https://www.w3.org/TR/webgpu/
3. SSA Form: Cytron et al., "Efficiently Computing Static Single Assignment Form"
4. Recursive Descent Parsing: Aho, Sethi, Ullman, "Compilers: Principles, Techniques, and Tools"
5. VQE Algorithm: Peruzzo et al., "A variational eigenvalue solver on a photonic quantum processor"

---

**End of Proposal**

