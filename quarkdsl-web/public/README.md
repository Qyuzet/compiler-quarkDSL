# QuarkDSL

Hybrid Quantum-Classical Compiler with TypeScript Virtual Machine

---

## Overview

| Property         | Value                                                               |
| ---------------- | ------------------------------------------------------------------- |
| **Type**         | Source-to-source compiler (transpiler) + Virtual Machine            |
| **Input**        | QuarkDSL (`.tgpu`)                                                  |
| **Output**       | WGSL (WebGPU Shading Language), Qiskit Python, Python Orchestrator  |
| **Language**     | Rust (native compiler), TypeScript (VM)                             |
| **Parser**       | RDP (Recursive Descent Parser), LL(1)-style                         |
| **Lexer**        | DFA (Deterministic Finite Automaton)-based                          |
| **IR**           | SSA (Static Single Assignment) / Stack-based bytecode (VM)          |
| **Backends**     | 3 (WGSL, Quantum, Orchestrator) + TypeScript VM                     |
| **Optimization** | DCE (Dead Code Elimination), CSE (Common Subexpression Elimination) |
| **Runtime**      | TypeScript VM with quantum simulator (8 qubits)                     |
| **Status**       | Complete                                                            |

---

## Grammar (EBNF)

```ebnf
program     ::= function*
function    ::= domain? "fn" IDENT "(" params ")" "->" type block
domain      ::= "@gpu" | "@quantum"
params      ::= (param ("," param)*)?
param       ::= IDENT ":" type
type        ::= "int" | "float" | "bool" | "void" | "qubit"
              | "[" type ("; INT)? "]"
              | "tensor" "<" type ">"
              | "qstate"
block       ::= "{" statement* "}"
statement   ::= let_stmt | assign_stmt | if_stmt | for_stmt
              | return_stmt | expr_stmt
let_stmt    ::= "let" IDENT (":" type)? "=" expression ";"
assign_stmt ::= IDENT ("[" expression "]")? "=" expression ";"
if_stmt     ::= "if" expression block ("else" block)?
for_stmt    ::= "for" IDENT "in" expression ".." expression block
return_stmt ::= "return" expression? ";"
expr_stmt   ::= expression ";"
expression  ::= or_expr
or_expr     ::= and_expr ("||" and_expr)*
and_expr    ::= eq_expr ("&&" eq_expr)*
eq_expr     ::= cmp_expr (("==" | "!=") cmp_expr)*
cmp_expr    ::= term (("<" | "<=" | ">" | ">=") term)*
term        ::= factor (("+" | "-") factor)*
factor      ::= unary (("*" | "/" | "%") unary)*
unary       ::= ("-" | "!")? postfix
postfix     ::= primary ("[" expression "]" | "(" args ")")*
primary     ::= INT | FLOAT | "true" | "false" | IDENT
              | "[" (expression ("," expression)*)? "]"
              | "(" expression ")"
              | "map" "(" IDENT "," expression ")"
args        ::= (expression ("," expression)*)?
```

---

## Operator Precedence

| Level       | Operators            | Associativity | Description                      |
| ----------- | -------------------- | ------------- | -------------------------------- |
| 1 (lowest)  | `\|\|`               | Left          | Logical OR                       |
| 2           | `&&`                 | Left          | Logical AND                      |
| 3           | `==`, `!=`           | Left          | Equality                         |
| 4           | `<`, `<=`, `>`, `>=` | Left          | Comparison                       |
| 5           | `+`, `-`             | Left          | Addition, Subtraction            |
| 6           | `*`, `/`, `%`        | Left          | Multiplication, Division, Modulo |
| 7           | `-`, `!`             | Right         | Unary negation, NOT              |
| 8 (highest) | `[]`, `()`           | Left          | Array index, Function call       |

---

## Tokens

### Keywords (8)

```
fn  let  return  if  else  for  in  map
```

### Annotations (2)

```
@gpu  @quantum
```

### Types (7)

```
int  float  bool  qubit  void  tensor  qstate
```

### Operators (19)

```
+  -  *  /  %  ==  !=  <  <=  >  >=  &&  ||  !  =
```

### Delimiters (11)

```
(  )  {  }  [  ]  ,  ;  :  ->  ..
```

### Literals (5)

| Token   | Regex                     | Example     |
| ------- | ------------------------- | ----------- |
| `INT`   | `[0-9]+`                  | `123`       |
| `FLOAT` | `[0-9]+\.[0-9]+`          | `3.14`      |
| `BOOL`  | `true \| false`           | `true`      |
| `IDENT` | `[a-zA-Z_][a-zA-Z0-9_]*`  | `foo`       |
| `ARRAY` | `[` expr (`,` expr)\* `]` | `[1, 2, 3]` |

### Skip Rules

```regex
[ \t\n\f]+      // Whitespace
//[^\n]*        // Single-line comments
```

---

## Type System

| Type    | Syntax            | Domain  | Example                  |
| ------- | ----------------- | ------- | ------------------------ |
| Integer | `int`             | All     | `let x: int = 5;`        |
| Float   | `float`           | All     | `let y: float = 3.14;`   |
| Boolean | `bool`            | All     | `let flag: bool = true;` |
| Qubit   | `qubit`           | Quantum | `let q: qubit;`          |
| Void    | `void`            | All     | `fn f() -> void`         |
| Array   | `[T]` or `[T; N]` | All     | `let arr: [int; 10];`    |
| Tensor  | `tensor<T>`       | GPU     | `let t: tensor<float>;`  |
| QState  | `qstate`          | Quantum | `let s: qstate;`         |

---

## Compiler Pipeline

```
.tgpu Source
    ↓
Lexer (DFA) → Tokens (47 types)
    ↓
Parser (RDP) → AST (Abstract Syntax Tree)
    ↓
Type Checker → Validated AST
    ↓
IR (Intermediate Representation) Lowering → SSA IR (auto-conversion insertion)
    ↓
Optimization → DCE (Dead Code Elimination), CSE (Common Subexpression Elimination)
    ↓
Code Generation
    ├── WGSL (WebGPU Shading Language) Backend (GPU shaders)
    ├── Quantum Backend (Qiskit circuits)
    └── Orchestrator Backend (Hybrid Python)
```

---

## Architecture

### Frontend

| Component    | File           | Technology                                   | Output                     |
| ------------ | -------------- | -------------------------------------------- | -------------------------- |
| Lexer        | `lexer.rs`     | Logos (DFA - Deterministic Finite Automaton) | Tokens                     |
| Parser       | `parser.rs`    | RDP (Recursive Descent Parser)               | AST (Abstract Syntax Tree) |
| Type Checker | `typecheck.rs` | Visitor pattern                              | Validated AST              |

### Middle-end

| Component    | File          | Algorithm                                                           | Output                            |
| ------------ | ------------- | ------------------------------------------------------------------- | --------------------------------- |
| IR Lowering  | `lower.rs`    | Two-pass (domain analysis + lowering)                               | SSA (Static Single Assignment) IR |
| Optimization | `optimize.rs` | DCE (Dead Code Elimination), CSE (Common Subexpression Elimination) | Optimized IR                      |
| IR Dump      | `dump.rs`     | Pretty-printer                                                      | Human-readable IR                 |

### Backend

| Component    | File              | Target | Output                                    |
| ------------ | ----------------- | ------ | ----------------------------------------- |
| WGSL         | `wgsl.rs`         | WebGPU | `.wgsl` (WebGPU Shading Language) shaders |
| Quantum      | `quantum.rs`      | Qiskit | `.py` circuits                            |
| Orchestrator | `orchestrator.rs` | Python | `.py` hybrid script                       |

---

## Parser Design (RDP - Recursive Descent Parser)

### Why Recursive Descent Parser (RDP)

**Definition:** Each grammar rule implemented as a function that calls other functions recursively.

### Implementation Evidence

```rust
// src/frontend/parser.rs
fn parse_expression(&mut self) -> Result<Expression> {
    self.parse_or()  // Calls parse_or
}

fn parse_or(&mut self) -> Result<Expression> {
    let mut left = self.parse_and()?;  // Calls parse_and
    while matches!(self.current(), Some(Token::OrOr)) {
        self.advance();
        let right = self.parse_and()?;
        left = Expression::Binary { op: BinaryOp::Or, left, right };
    }
    Ok(left)
}

fn parse_and(&mut self) -> Result<Expression> {
    let mut left = self.parse_equality()?;  // Calls parse_equality
    // ...
}
```

### Recursive Call Chain

```
parse_program()
  → parse_function()
    → parse_params()
    → parse_type()
    → parse_statements()
      → parse_statement()
        → parse_expression()
          → parse_or()
            → parse_and()
              → parse_equality()
                → parse_comparison()
                  → parse_term()
                    → parse_factor()
                      → parse_unary()
                        → parse_postfix()
                          → parse_primary()
```

### RDP (Recursive Descent Parser) Characteristics

| Feature                       | QuarkDSL Implementation                                       |
| ----------------------------- | ------------------------------------------------------------- |
| One function per grammar rule | `parse_function()`, `parse_statement()`, `parse_expression()` |
| Recursive calls               | Functions call each other recursively                         |
| Hand-written                  | No parser generator used                                      |
| Top-down parsing              | Starts from `parse_program()`                                 |
| Predictive (1 lookahead)      | Uses `self.current()` to decide production                    |
| LL(1)-style                   | LL(1) - Left-to-right, Leftmost derivation, 1 lookahead       |

### Not RDP (Recursive Descent Parser)

| Type                                                 | Characteristics    | QuarkDSL |
| ---------------------------------------------------- | ------------------ | -------- |
| Table-driven LL(1)                                   | Uses parse table   | No       |
| Bottom-up (LR - Left-to-right, Rightmost derivation) | Shift-reduce       | No       |
| Generated                                            | Yacc, Bison, ANTLR | No       |

---

## IR (Intermediate Representation) Design

### SSA (Static Single Assignment) Instructions

```rust
Assign(var, value)              // x = value
BinOp(result, op, left, right)  // result = left op right
UnOp(result, op, operand)       // result = op operand
Call(result, func, args)        // result = func(args)
ArrayIndex(result, array, idx)  // result = array[idx]
ArraySet(array, idx, value)     // array[idx] = value
Return(value)                   // return value
Branch(cond, then, else)        // if cond { then } else { else }
Loop(var, start, end, body)     // for var in start..end { body }
DomainConversion(result, value, from, to)  // result = convert(value)
```

### Domain Annotations

```rust
Domain::Classical  // CPU (default)
Domain::Gpu        // @gpu
Domain::Quantum    // @quantum
```

---

## CLI (Command Line Interface)

### Build

```bash
cargo build
```

### Parse Only

```bash
cargo run -- parse examples/hybrid.tgpu
```

### Lower to IR (Intermediate Representation)

```bash
cargo run -- lower examples/hybrid.tgpu
```

### Compile

#### WGSL (WebGPU Shading Language)

```bash
cargo run -- compile examples/hybrid.tgpu -t wgsl -o output.wgsl
```

#### Quantum (Qiskit)

```bash
cargo run -- compile examples/hybrid.tgpu -t quantum -o output.py
```

#### Orchestrator (Hybrid Python)

```bash
cargo run -- compile examples/hybrid.tgpu -t orchestrator -o demo.py
```

### With Optimization

```bash
cargo run -- compile examples/hybrid.tgpu -t orchestrator -o demo.py --optimize
```

### With IR (Intermediate Representation) Dump

```bash
cargo run -- compile examples/hybrid.tgpu -t orchestrator -o demo.py --dump-ir
```

### With Both Flags

```bash
cargo run -- compile examples/hybrid.tgpu -t orchestrator -o demo.py --optimize --dump-ir
```

### Execute Generated Code

```bash
python demo.py
```

### Test

```bash
cargo test
```

### Clean

```bash
cargo clean
```

---

## Example

### Input (`hybrid.tgpu`)

```rust
@gpu
fn preprocess(x: [float]) -> [float] {
    let result = [0.0, 0.0];
    for i in 0..2 {
        result[i] = x[i] * 2.0;
    }
    return result;
}

@quantum
fn encode(data: [float]) -> int {
    ry(0, data[0]);
    ry(1, data[1]);
    return 0;
}

fn main(input: [float]) -> int {
    let features = preprocess(input);  // GPU
    encode(features);                  // Auto-convert: GPU → Quantum
    return 0;
}
```

### Output (Orchestrator)

```python
import numpy as np
from qiskit import QuantumCircuit
from qiskit_aer import AerSimulator

# GPU function (NumPy simulation)
def preprocess(x):
    result = np.zeros(2)
    for i in range(2):
        result[i] = x[i] * 2.0
    return result

# Quantum function (Qiskit)
def encode(data):
    qc = QuantumCircuit(2)
    qc.ry(data[0], 0)
    qc.ry(data[1], 1)
    return 0

# Orchestrator
def main(input):
    features = preprocess(input)
    # Auto-conversion: GPU tensor → Quantum state
    encode(features)
    return 0
```

---

## Statistics

| Metric                                        | Value  |
| --------------------------------------------- | ------ |
| Total LOC (Lines of Code)                     | ~3,500 |
| Rust files                                    | 13     |
| Token types                                   | 47     |
| AST (Abstract Syntax Tree) node types         | 8      |
| IR (Intermediate Representation) instructions | 10     |
| Optimization passes                           | 2      |
| Backends                                      | 3      |
| Example programs                              | 7      |
| Build errors                                  | 0      |
| Build warnings                                | 0      |

---

## Features

### Automatic Data Marshalling

- GPU (Graphics Processing Unit) tensor → Quantum state (angle encoding)
- Quantum state → GPU tensor (measurement)
- Inserted at compile time (IR - Intermediate Representation lowering)

### Cross-Domain Optimization

- DCE (Dead Code Elimination)
- CSE (Common Subexpression Elimination)
- Domain-aware optimization

### Multi-Backend

- WGSL (WebGPU Shading Language): GPU compute shaders
- Qiskit: Quantum circuits
- Orchestrator: Hybrid execution

### IBM Quantum Hardware Support

- Conditional execution: Simulator or real quantum computer
- Single flag toggle: `USE_QUANTUM_COMPUTER = True/False`
- Automatic backend selection: Least busy IBM Quantum system
- Embedded API key: Ready to use
- Supports 127+ qubit systems: ibm_brisbane, ibm_kyoto, ibm_osaka

---

## Execution

### Compilation

```bash
cargo run -- compile hybrid.tgpu -t orchestrator -o demo.py
```

### Execution (Simulation - Default)

```bash
python demo.py
# Uses: Qiskit Aer (quantum simulator), NumPy (GPU simulation)
```

### Execution (IBM Quantum Hardware)

**Step 1:** Edit generated code and set:

```python
USE_QUANTUM_COMPUTER = True  # Change from False to True
```

**Step 2:** Run:

```bash
python demo.py
# Uses: Real IBM Quantum hardware (ibm_brisbane, ibm_kyoto, etc.)
# API Key: krPjNWz0BsR_PSI0UVVG_VxIFSA27a5SaEgpLlI22-F-
```

**Documentation:** See `docs/IBM_QUANTUM_INTEGRATION.md` for details.

---

## TypeScript Virtual Machine

The TypeScript VM provides an alternative execution path that runs entirely in the browser.

### Features

- Stack-based bytecode interpreter
- Full quantum state vector simulation (8 qubits, 256 amplitudes)
- Quantum gates: H, X, Y, Z, RX, RY, RZ, CNOT, SWAP, Toffoli
- Probabilistic measurement with state collapse
- Web playground for interactive development

### Web Playground

The TypeScript VM powers the interactive web playground at `quarkdsl-web/`. Users can write QuarkDSL code and execute it directly in the browser with real-time quantum simulation.

### VM Architecture

```
QuarkDSL Source
    |
Lexer (TypeScript) -> Tokens
    |
Parser (TypeScript) -> AST
    |
Compiler -> Bytecode
    |
VM Execution
    |-- Classical operations (stack-based)
    |-- GPU operations (array simulation)
    +-- Quantum operations (state vector simulation)
```

### Built-in Functions

| Function                     | Description               |
| ---------------------------- | ------------------------- |
| `print(x)`                   | Print any value           |
| `print_int(n)`               | Print integer             |
| `print_float(n)`             | Print float               |
| `print_array(arr)`           | Print array               |
| `sqrt(x)`                    | Square root               |
| `sin(x)`, `cos(x)`, `tan(x)` | Trigonometric functions   |
| `exp(x)`, `log(x)`           | Exponential and logarithm |
| `abs(x)`                     | Absolute value            |
| `min(a,b)`, `max(a,b)`       | Minimum and maximum       |
| `len(arr)`                   | Array length              |
| `random()`                   | Random number [0,1)       |

---

## License

MIT
