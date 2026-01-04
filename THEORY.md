# QuarkDSL Compiler Theory Documentation

This document maps the QuarkDSL compiler implementation to formal compiler theory concepts and compilation techniques.

## Table of Contents

1. [Lexical Analysis](#1-lexical-analysis)
2. [Syntax Analysis](#2-syntax-analysis)
3. [Semantic Analysis](#3-semantic-analysis)
4. [Intermediate Representation](#4-intermediate-representation)
5. [Optimization](#5-optimization)
6. [Code Generation](#6-code-generation)
7. [Runtime Systems](#7-runtime-systems)

---

## 1. Lexical Analysis

### Theory

Lexical analysis is the first phase of compilation that converts a stream of characters into a stream of tokens.

**Key Concepts:**

- Regular Expressions: Patterns that describe token structure
- DFA (Deterministic Finite Automaton): State machine for token recognition
- Thompson's Construction: Algorithm to convert regex to epsilon-NFA
- Subset Construction: Algorithm to convert NFA to DFA
- DFA Minimization: Reduce number of states in DFA
- Maximal Munch: Always take the longest matching token

**Process:**

```
Source Code → Regex Patterns → ε-NFA → NFA → DFA → Minimized DFA → Tokens
```

### Implementation

**File:** `src/frontend/lexer.rs`

**Technology:** Logos library (automatic DFA generation from regex)

**Token Categories:**

1. Keywords: `fn`, `let`, `return`, `if`, `else`, `for`, `in`, `map`
2. Annotations: `@gpu`, `@quantum`
3. Types: `int`, `float`, `bool`, `qubit`, `void`, `tensor`, `qstate`
4. Literals: Integer, Float, String, Boolean
5. Identifiers: Variable and function names
6. Operators: `+`, `-`, `*`, `/`, `==`, `!=`, `<`, `>`, `<=`, `>=`
7. Delimiters: `(`, `)`, `{`, `}`, `[`, `]`, `;`, `,`, `:`

**Regex Examples:**

- Identifier: `[a-zA-Z_][a-zA-Z0-9_]*`
- Integer: `[0-9]+`
- Float: `[0-9]+\.[0-9]+`
- Whitespace (skip): `[ \t\n\f]+`
- Comments (skip): `//[^\n]*`

**DFA State Machine:**
The Logos library automatically generates a DFA from regex patterns. For example, the identifier regex creates states:

```
State 0 (start) --[a-zA-Z_]--> State 1 (accepting)
State 1 --[a-zA-Z0-9_]--> State 1 (loop)
State 1 --[other]--> State 0 (reject)
```

---

## 2. Syntax Analysis

### Theory

Syntax analysis (parsing) verifies that tokens form valid grammatical structures according to a Context-Free Grammar (CFG).

**Key Concepts:**

- Context-Free Grammar (CFG): Formal grammar with production rules
- Derivation: Process of generating strings from grammar
- Parse Tree: Tree showing derivation steps
- Abstract Syntax Tree (AST): Simplified parse tree
- Top-Down Parsing: Start from root, expand to leaves
- Recursive Descent Parser (RDP): Top-down parser where each rule is a function
- LL(1) Grammar: Left-to-right scan, Leftmost derivation, 1 lookahead token
- Left Recursion: Grammar rule that references itself on the left (must be eliminated for RDP)
- Left Factoring: Extracting common prefixes to enable predictive parsing
- First Set: Set of terminals that can start a production
- Follow Set: Set of terminals that can follow a non-terminal

**Grammar Classification:**

- Type 0: Unrestricted Grammar
- Type 1: Context-Sensitive Grammar
- Type 2: Context-Free Grammar (CFG) - Used in QuarkDSL
- Type 3: Regular Grammar (used in lexical analysis)

**QuarkDSL Grammar (Simplified CFG):**

```
Program    → Function*
Function   → Domain? "fn" Identifier "(" Parameters ")" "->" Type Block
Domain     → "@gpu" | "@quantum"
Parameters → (Parameter ("," Parameter)*)?
Parameter  → Identifier ":" Type
Type       → "int" | "float" | "bool" | "qubit" | "void" | "[" Type "]"
Block      → "{" Statement* "}"
Statement  → LetStmt | ReturnStmt | IfStmt | ForStmt | AssignStmt | ExprStmt
LetStmt    → "let" Identifier (":" Type)? "=" Expression ";"
ReturnStmt → "return" Expression ";"
IfStmt     → "if" Expression Block ("else" Block)?
ForStmt    → "for" Identifier "in" Range Block
AssignStmt → Identifier "[" Expression "]" "=" Expression ";"
ExprStmt   → Expression ";"
Expression → LogicalOr
LogicalOr  → LogicalAnd ("||" LogicalAnd)*
LogicalAnd → Equality ("&&" Equality)*
Equality   → Comparison (("==" | "!=") Comparison)*
Comparison → Term (("<" | ">" | "<=" | ">=") Term)*
Term       → Factor (("+" | "-") Factor)*
Factor     → Unary (("*" | "/") Unary)*
Unary      → ("!" | "-") Unary | Primary
Primary    → Literal | Identifier | Call | Index | "(" Expression ")"
Call       → Identifier "(" Arguments ")"
Index      → Identifier "[" Expression "]"
Range      → Expression ".." Expression
```

**Left Recursion Elimination Example:**

Original (left-recursive, bad for RDP):

```
Expression → Expression "+" Term
           | Term
```

Transformed (right-recursive, good for RDP):

```
Expression → Term Expression'
Expression' → "+" Term Expression'
            | ε
```

Implemented as iteration:

```
Expression → Term ("+" Term)*
```

**Left Factoring Example:**

Original (ambiguous):

```
Statement → "if" Expression Block
          | "if" Expression Block "else" Block
```

Factored (unambiguous):

```
Statement → "if" Expression Block ("else" Block)?
```

### Implementation

**File:** `src/frontend/parser.rs`

**Technique:** Recursive Descent Parser (RDP)

**Parser Structure:**

- Each grammar rule is implemented as a function
- Functions call each other recursively
- One token lookahead for decision making
- Returns AST nodes

**Key Functions:**

- `parse_program()` - Entry point, parses entire program
- `parse_function()` - Parses function definition
- `parse_statement()` - Parses statements
- `parse_expression()` - Parses expressions with precedence
- `parse_term()` - Parses multiplication/division
- `parse_factor()` - Parses unary operations
- `parse_primary()` - Parses literals, identifiers, calls

**Precedence Levels (lowest to highest):**

1. Logical OR (`||`)
2. Logical AND (`&&`)
3. Equality (`==`, `!=`)
4. Comparison (`<`, `>`, `<=`, `>=`)
5. Addition/Subtraction (`+`, `-`)
6. Multiplication/Division (`*`, `/`)
7. Unary (`!`, `-`)
8. Primary (literals, identifiers, calls, indexing)

**AST Node Types:**

- `Program` - Root node containing functions
- `Function` - Function definition with domain, parameters, body
- `Statement` - Let, Return, If, For, Assignment, Expression
- `Expression` - Binary operations, unary operations, literals, calls
- `Type` - Type annotations

---

## 3. Semantic Analysis

### Theory

Semantic analysis verifies that the program is meaningful beyond just syntactic correctness.

**Key Concepts:**

- Type Checking: Verify operations are type-safe
- Symbol Table: Data structure tracking identifiers and their attributes
- Scope: Region where an identifier is visible
- Type System: Rules for assigning types to expressions
- Type Inference: Automatically deduce types
- Semantic Errors: Type mismatches, undefined variables, duplicate declarations

**Type Checking Rules:**

- Binary operations: Both operands must have compatible types
- Function calls: Argument types must match parameter types
- Assignments: Right-hand side type must match left-hand side type
- Return statements: Return type must match function signature
- Array indexing: Index must be integer type

**Symbol Table Operations:**

- Insert: Add new identifier to table
- Lookup: Find identifier and retrieve attributes
- Enter Scope: Create new scope level
- Exit Scope: Remove scope level and its identifiers

### Implementation

**Files:** `src/frontend/parser.rs`, `src/middle/lower.rs`

**Type System:**

- Primitive types: `int`, `float`, `bool`, `qubit`, `void`
- Composite types: Arrays `[T]`, Tensors `tensor<T>`, Quantum states `qstate`
- Domain-specific types: GPU types, Quantum types

**Type Checking:**
Type checking is performed during AST construction and IR lowering. The compiler maintains type information for all variables and expressions.

**Scope Management:**
Scopes are managed implicitly through the parser's recursive structure. Each function has its own scope, and nested blocks create nested scopes.

---

## 4. Intermediate Representation

### Theory

Intermediate Representation (IR) is a language-independent representation between source code and target code.

**Key Concepts:**

- Three-Address Code: Instructions with at most three operands
- Static Single Assignment (SSA): Each variable assigned exactly once
- Basic Block: Sequence of instructions with single entry and exit
- Control Flow Graph (CFG): Graph of basic blocks
- Dominance: Block A dominates B if all paths to B go through A
- Phi Function: Merge values from different control flow paths
- Def-Use Chain: Link between variable definition and uses
- Use-Def Chain: Link between variable use and definitions

**SSA Form Benefits:**

- Simplifies optimization algorithms
- Makes dataflow explicit
- Eliminates need for complex dataflow analysis
- Each variable has single definition point
- Enables efficient constant propagation and dead code elimination

**Three-Address Code Format:**

```
result = operand1 operator operand2
```

Examples:

```
t1 = a + b
t2 = t1 * c
t3 = -t2
x = t3
```

**Phi Function:**
Used to merge values from different control flow paths in SSA form.

```
if (condition) {
    x1 = 5;
} else {
    x2 = 10;
}
x3 = φ(x1, x2);  // x3 gets x1 or x2 depending on which path was taken
```

### Implementation

**File:** `src/middle/ir.rs`

**IR Structure:**

- `Module` - Collection of functions
- `IRFunction` - Function with parameters, return type, basic blocks
- `BasicBlock` - Label, instructions, terminator
- `Instruction` - SSA instructions (Assign, BinaryOp, UnaryOp, Load, Store, Call, etc.)
- `Terminator` - Control flow (Jump, Branch, Return)
- `Value` - SSA variable, constant, or parameter
- `SSAVar` - Unique variable identifier

**Instruction Types:**

- `Assign` - Variable assignment
- `BinaryOp` - Binary operations (add, sub, mul, div, etc.)
- `UnaryOp` - Unary operations (neg, not)
- `Load` - Array element load
- `Store` - Array element store
- `Call` - Function call
- `QuantumGate` - Quantum gate application
- `Measure` - Quantum measurement
- `DomainConversion` - Cross-domain data transfer

**SSA Variable Naming:**
Variables are numbered sequentially: `%0`, `%1`, `%2`, etc.
Each assignment creates a new SSA variable.

**Lowering Process:**

```
AST → IR Lowering → SSA Form
```

The lowering pass converts AST to IR by:

1. Analyzing domains of all functions
2. Converting expressions to three-address code
3. Generating SSA variables for each assignment
4. Creating basic blocks for control flow
5. Inserting terminators at block ends

---

## 5. Optimization

### Theory

Optimization improves program performance without changing semantics.

**Key Concepts:**

- Dataflow Analysis: Analyze how data flows through program
- Liveness Analysis: Determine which variables are live at each point
- Reaching Definitions: Which assignments reach a program point
- Available Expressions: Which expressions are already computed
- Dead Code Elimination (DCE): Remove code that doesn't affect output
- Common Subexpression Elimination (CSE): Reuse computed values
- Constant Folding: Evaluate constant expressions at compile time
- Constant Propagation: Replace variables with their constant values
- Copy Propagation: Replace copies with original values
- Loop Optimization: Improve loop performance

**Dead Code Elimination:**
Remove instructions whose results are never used.

```
x = 5;      // Dead if x is never used
y = x + 3;  // Dead if y is never used
return 10;
```

**Common Subexpression Elimination:**
Reuse previously computed values.

```
// Before CSE:
a = b + c;
d = b + c;  // Redundant computation

// After CSE:
a = b + c;
d = a;      // Reuse result
```

**Constant Folding:**
Evaluate constant expressions at compile time.

```
// Before:
x = 2 + 3;
y = x * 4;

// After:
x = 5;
y = 20;
```

### Implementation

**File:** `src/middle/optimize.rs`

**Optimization Passes:**

1. Dead Code Elimination (DCE)

   - Build use-count map for all SSA variables
   - Mark instructions whose results are used
   - Remove unmarked instructions
   - Leverages SSA form's explicit def-use chains

2. Common Subexpression Elimination (CSE)
   - Track computed expressions
   - Detect duplicate computations
   - Replace duplicates with references to first computation
   - Uses expression hashing for efficient lookup

**Optimization Pipeline:**

```
IR → DCE → CSE → Optimized IR
```

The optimizer can be enabled with the `--optimize` flag.

---

## 6. Code Generation

### Theory

Code generation translates IR to target machine or language code.

**Key Concepts:**

- Instruction Selection: Choose target instructions for IR operations
- Register Allocation: Assign variables to registers or memory
- Instruction Scheduling: Reorder instructions for performance
- Peephole Optimization: Local optimizations on small code windows
- Code Templates: Patterns for translating IR to target code

**Instruction Selection:**
Map IR instructions to target instructions.

```
IR: t1 = a + b
Target (x86): ADD eax, ebx
Target (WGSL): let t1 = a + b;
```

**Register Allocation:**
Assign unlimited SSA variables to limited physical registers.
Techniques: Graph coloring, linear scan

### Implementation

**Files:** `src/backend/wgsl.rs`, `src/backend/quantum.rs`, `src/backend/orchestrator.rs`

**Multi-Backend Architecture:**

QuarkDSL supports three code generation backends:

1. WGSL Backend (`wgsl.rs`)

   - Target: WebGPU Shading Language
   - Domain: GPU functions
   - Output: `.wgsl` shader files
   - Features: Parallel computation, array operations

2. Quantum Backend (`quantum.rs`)

   - Target: Qiskit Python
   - Domain: Quantum functions
   - Output: `.py` quantum circuit files
   - Features: Quantum gates, measurement, state preparation

3. Orchestrator Backend (`orchestrator.rs`)
   - Target: Python
   - Domain: Hybrid quantum-classical workflows
   - Output: `.py` orchestration scripts
   - Features: Cross-domain calls, data marshalling, IBM Quantum integration

**Code Generation Process:**

```
IR → Pattern Matching → Target Code Emission → Output File
```

Each backend:

1. Traverses IR basic blocks
2. Pattern matches on instruction types
3. Emits corresponding target code
4. Handles domain-specific features

**Domain-Specific Code Generation:**

- GPU functions generate parallel array operations
- Quantum functions generate quantum circuits
- Hybrid functions generate orchestration code with domain transitions

---

## 7. Runtime Systems

### Theory

Runtime systems provide execution environment for compiled programs.

**Key Concepts:**

- Virtual Machine (VM): Software that executes bytecode
- Interpreter: Directly executes source or IR without compilation
- Stack-Based VM: Uses operand stack for computation
- Register-Based VM: Uses virtual registers
- Bytecode: Compact instruction encoding
- Fetch-Decode-Execute Cycle: VM execution loop
- Stack Frame: Activation record for function calls
- Heap: Dynamic memory allocation
- Garbage Collection: Automatic memory management

**Stack-Based VM:**

```
Bytecode: PUSH 5, PUSH 3, ADD

Execution:
Stack: []
PUSH 5 → Stack: [5]
PUSH 3 → Stack: [5, 3]
ADD    → Stack: [8]
```

**Register-Based VM:**

```
Bytecode: LOAD R1, 5; LOAD R2, 3; ADD R3, R1, R2

Execution:
Registers: R1=0, R2=0, R3=0
LOAD R1, 5  → R1=5
LOAD R2, 3  → R2=3
ADD R3, R1, R2 → R3=8
```

**Fetch-Decode-Execute Cycle:**

```
while (pc < bytecode.length) {
    instruction = fetch(bytecode[pc]);
    decode(instruction);
    execute(instruction);
    pc++;
}
```

### Implementation

**Status:** Complete (TypeScript VM)

**Files:** `quarkdsl-web/lib/vm/`

**Architecture:**

- Stack-based VM for simplicity and portability
- Custom bytecode format (not SSA IR)
- Full quantum state vector simulation
- Browser and Node.js compatible

**VM Components:**

| Component         | File                   | Description                      |
| ----------------- | ---------------------- | -------------------------------- |
| Lexer             | `lexer.ts`             | DFA-based tokenizer              |
| Parser            | `parser.ts`            | Recursive descent parser         |
| Compiler          | `compiler.ts`          | AST to bytecode compiler         |
| VM                | `vm.ts`                | Stack-based bytecode interpreter |
| Quantum Simulator | `quantum-simulator.ts` | 8-qubit state vector simulator   |
| Quantum Gates     | `quantum-gates.ts`     | Gate implementations             |

**Bytecode Opcodes:**

```typescript
enum Opcode {
  // Stack operations
  PUSH,
  POP,
  DUP,
  // Arithmetic
  ADD,
  SUB,
  MUL,
  DIV,
  MOD,
  NEG,
  // Comparison
  EQ,
  NE,
  LT,
  LE,
  GT,
  GE,
  // Logic
  AND,
  OR,
  NOT,
  // Variables
  LOAD,
  STORE,
  LOAD_GLOBAL,
  STORE_GLOBAL,
  // Control flow
  JUMP,
  JUMP_IF_FALSE,
  CALL,
  RETURN,
  // Arrays
  ARRAY_NEW,
  ARRAY_GET,
  ARRAY_SET,
  ARRAY_LEN,
  // Quantum operations
  QUANTUM_H,
  QUANTUM_X,
  QUANTUM_Y,
  QUANTUM_Z,
  QUANTUM_RX,
  QUANTUM_RY,
  QUANTUM_RZ,
  QUANTUM_CNOT,
  QUANTUM_SWAP,
  QUANTUM_TOFFOLI,
  QUANTUM_MEASURE,
  QUANTUM_RESET,
}
```

**Quantum Simulator:**

The quantum simulator maintains a full state vector for up to 8 qubits (256 complex amplitudes):

```typescript
class QuantumSimulator {
  private stateVector: Complex[]; // 2^n amplitudes
  private numQubits: number; // Max 8 qubits

  applyGate(gate: QuantumGate, targets: number[]): void;
  measure(qubit: number): number; // Returns 0 or 1
  reset(): void;
}
```

**Quantum Gates Implemented:**

| Gate      | Matrix         | Description                           |
| --------- | -------------- | ------------------------------------- |
| H         | Hadamard       | Creates superposition                 |
| X         | Pauli-X        | Bit flip (NOT)                        |
| Y         | Pauli-Y        | Bit and phase flip                    |
| Z         | Pauli-Z        | Phase flip                            |
| RX(theta) | X-rotation     | Rotation around X-axis                |
| RY(theta) | Y-rotation     | Rotation around Y-axis                |
| RZ(theta) | Z-rotation     | Rotation around Z-axis                |
| CNOT      | Controlled-NOT | Two-qubit entangling gate             |
| SWAP      | Swap           | Exchanges two qubits                  |
| Toffoli   | CCX            | Three-qubit controlled-controlled-NOT |

**Execution Model:**

```
QuarkDSL Source
    ↓
Lexer → Tokens
    ↓
Parser → AST
    ↓
Compiler → Bytecode
    ↓
VM Execution
    ├── Classical: Stack-based computation
    ├── GPU: Array operations (JavaScript simulation)
    └── Quantum: State vector simulation
```

**Example Execution:**

```typescript
// QuarkDSL code
@quantum
fn bell_state() -> int {
    h(0);
    cx(0, 1);
    return measure(0);
}

// Compiled bytecode
[
  QUANTUM_H, 0,        // Apply H to qubit 0
  QUANTUM_CNOT, 0, 1,  // Apply CNOT with control=0, target=1
  QUANTUM_MEASURE, 0,  // Measure qubit 0
  RETURN               // Return measurement result
]

// VM execution
// 1. Initialize |00> state
// 2. H gate: |00> -> (|00> + |10>)/sqrt(2)
// 3. CNOT: (|00> + |10>)/sqrt(2) -> (|00> + |11>)/sqrt(2)
// 4. Measure: Returns 0 or 1 with 50% probability each
```

---

## Compiler Pipeline Summary

### Native Compiler (Rust)

```
Source Code (.tgpu)
    ↓
[1. Lexical Analysis]
    Regex → DFA → Tokens
    ↓
[2. Syntax Analysis]
    Tokens → RDP → AST
    ↓
[3. Semantic Analysis]
    Type Checking → Validated AST
    ↓
[4. IR Generation]
    AST → Lowering → SSA IR
    ↓
[5. Optimization]
    DCE, CSE → Optimized IR
    ↓
[6. Code Generation]
    ├─→ WGSL Backend → .wgsl (GPU)
    ├─→ Quantum Backend → .py (Qiskit)
    └─→ Orchestrator Backend → .py (Hybrid)
```

### TypeScript VM

```
Source Code (.tgpu)
    ↓
[1. Lexical Analysis]
    DFA Lexer → Tokens
    ↓
[2. Syntax Analysis]
    RDP Parser → AST
    ↓
[3. Compilation]
    AST → Bytecode
    ↓
[4. Execution]
    Stack-based VM
    ├─→ Classical operations
    ├─→ GPU simulation (arrays)
    └─→ Quantum simulation (state vector)
```

---

## Theoretical Foundations

### Chomsky Hierarchy

QuarkDSL uses different grammar types at different stages:

| Level  | Grammar Type      | Used In           | Example                          |
| ------ | ----------------- | ----------------- | -------------------------------- |
| Type 3 | Regular           | Lexical Analysis  | `[a-zA-Z_][a-zA-Z0-9_]*`         |
| Type 2 | Context-Free      | Syntax Analysis   | `Expression → Term + Expression` |
| Type 1 | Context-Sensitive | Semantic Analysis | Type checking rules              |
| Type 0 | Unrestricted      | Not used          | N/A                              |

### Parsing Techniques Comparison

| Technique         | Type      | Lookahead | Grammar | Used in QuarkDSL |
| ----------------- | --------- | --------- | ------- | ---------------- |
| Recursive Descent | Top-Down  | 1         | LL(1)   | Yes              |
| LL Parser         | Top-Down  | k         | LL(k)   | No               |
| LR Parser         | Bottom-Up | 1         | LR(1)   | No               |
| LALR Parser       | Bottom-Up | 1         | LALR(1) | No               |

### Optimization Classification

| Type            | Scope         | Examples                                   | Implemented    |
| --------------- | ------------- | ------------------------------------------ | -------------- |
| Local           | Basic Block   | Constant folding, algebraic simplification | Partial        |
| Global          | Function      | DCE, CSE, constant propagation             | Yes (DCE, CSE) |
| Interprocedural | Whole Program | Inlining, dead function elimination        | No             |
| Loop            | Loops         | Loop unrolling, invariant code motion      | Partial        |

---

## References

1. Aho, A. V., Lam, M. S., Sethi, R., & Ullman, J. D. (2006). Compilers: Principles, Techniques, and Tools (2nd ed.). Addison-Wesley.

2. Appel, A. W. (2004). Modern Compiler Implementation in ML. Cambridge University Press.

3. Cooper, K. D., & Torczon, L. (2011). Engineering a Compiler (2nd ed.). Morgan Kaufmann.

4. Cytron, R., Ferrante, J., Rosen, B. K., Wegman, M. N., & Zadeck, F. K. (1991). Efficiently computing static single assignment form and the control dependence graph. ACM Transactions on Programming Languages and Systems, 13(4), 451-490.

5. Muchnick, S. S. (1997). Advanced Compiler Design and Implementation. Morgan Kaufmann.
