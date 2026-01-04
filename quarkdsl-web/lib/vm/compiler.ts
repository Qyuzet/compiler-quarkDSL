/**
 * QuarkDSL Compiler - AST to IR lowering
 * Converts parsed AST into stack-based bytecode
 */

import {
  Program,
  Function,
  Statement,
  Expression,
  BinaryOp,
  UnaryOp,
} from "./ast";
import { OpCode, Instruction, IRFunction, IRModule } from "./ir";

export class Compiler {
  private instructions: Instruction[] = [];
  private labelCounter: number = 0;
  private labels: Map<string, number> = new Map();
  private pendingJumps: Map<string, number[]> = new Map();

  compile(program: Program): IRModule {
    const functions = new Map<string, IRFunction>();

    for (const func of program.functions) {
      const irFunc = this.compileFunction(func);
      functions.set(func.name, irFunc);
    }

    return { functions };
  }

  private compileFunction(func: Function): IRFunction {
    this.instructions = [];
    this.labels.clear();
    this.pendingJumps.clear();

    for (const stmt of func.body) {
      this.compileStatement(stmt);
    }

    // Ensure function ends with return
    if (
      this.instructions.length === 0 ||
      this.instructions[this.instructions.length - 1].op !== OpCode.Return
    ) {
      this.emit(OpCode.Push, 0);
      this.emit(OpCode.Return);
    }

    // Resolve pending jumps
    this.resolvePendingJumps();

    return {
      name: func.name,
      params: func.params.map((p) => p.name),
      instructions: [...this.instructions],
      domain: func.domain,
    };
  }

  private emit(op: OpCode, operand?: unknown, operand2?: unknown): number {
    const idx = this.instructions.length;
    this.instructions.push({
      op,
      operand: operand as Instruction["operand"],
      operand2: operand2 as Instruction["operand2"],
    });
    return idx;
  }

  private newLabel(): string {
    return `L${this.labelCounter++}`;
  }

  private markLabel(label: string): void {
    this.labels.set(label, this.instructions.length);
  }

  private emitJump(op: OpCode, label: string): void {
    const idx = this.emit(op, 0);
    if (!this.pendingJumps.has(label)) {
      this.pendingJumps.set(label, []);
    }
    this.pendingJumps.get(label)!.push(idx);
  }

  private resolvePendingJumps(): void {
    for (const [label, indices] of this.pendingJumps) {
      const target = this.labels.get(label);
      if (target !== undefined) {
        for (const idx of indices) {
          this.instructions[idx].operand = target;
        }
      }
    }
  }

  private compileStatement(stmt: Statement): void {
    switch (stmt.kind) {
      case "Let":
        this.compileExpression(stmt.value);
        this.emit(OpCode.Store, stmt.name);
        break;

      case "Assign":
        if (stmt.index) {
          this.emit(OpCode.Load, stmt.target);
          this.compileExpression(stmt.index);
          this.compileExpression(stmt.value);
          this.emit(OpCode.StoreIndex);
        } else {
          this.compileExpression(stmt.value);
          this.emit(OpCode.Store, stmt.target);
        }
        break;

      case "Return":
        this.compileExpression(stmt.value);
        this.emit(OpCode.Return);
        break;

      case "Expression":
        this.compileExpression(stmt.expr);
        this.emit(OpCode.Pop);
        break;

      case "For":
        this.compileFor(stmt);
        break;

      case "If":
        this.compileIf(stmt);
        break;
    }
  }

  private compileFor(stmt: Extract<Statement, { kind: "For" }>): void {
    const loopStart = this.newLabel();
    const loopEnd = this.newLabel();

    // Initialize loop variable
    this.compileExpression(stmt.start);
    this.emit(OpCode.Store, stmt.var);

    // Loop condition
    this.markLabel(loopStart);
    this.emit(OpCode.Load, stmt.var);
    this.compileExpression(stmt.end);
    this.emit(OpCode.Lt);
    this.emitJump(OpCode.JumpIfFalse, loopEnd);

    // Loop body
    for (const s of stmt.body) {
      this.compileStatement(s);
    }

    // Increment and jump back
    this.emit(OpCode.Load, stmt.var);
    this.emit(OpCode.Push, 1);
    this.emit(OpCode.Add);
    this.emit(OpCode.Store, stmt.var);
    this.emitJump(OpCode.Jump, loopStart);

    this.markLabel(loopEnd);
  }

  private compileIf(stmt: Extract<Statement, { kind: "If" }>): void {
    const elseLabel = this.newLabel();
    const endLabel = this.newLabel();

    this.compileExpression(stmt.condition);
    this.emitJump(OpCode.JumpIfFalse, stmt.elseBody ? elseLabel : endLabel);

    for (const s of stmt.thenBody) {
      this.compileStatement(s);
    }

    if (stmt.elseBody) {
      this.emitJump(OpCode.Jump, endLabel);
      this.markLabel(elseLabel);
      for (const s of stmt.elseBody) {
        this.compileStatement(s);
      }
    }

    this.markLabel(endLabel);
  }

  private compileExpression(expr: Expression): void {
    switch (expr.kind) {
      case "IntLiteral":
      case "FloatLiteral":
        this.emit(OpCode.Push, expr.value);
        break;

      case "BoolLiteral":
        this.emit(OpCode.Push, expr.value ? 1 : 0);
        break;

      case "Variable":
        this.emit(OpCode.Load, expr.name);
        break;

      case "Binary":
        this.compileExpression(expr.left);
        this.compileExpression(expr.right);
        this.emit(this.binaryOpToOpCode(expr.op));
        break;

      case "Unary":
        this.compileExpression(expr.operand);
        this.emit(expr.op === UnaryOp.Neg ? OpCode.Neg : OpCode.Not);
        break;

      case "Call":
        // Push arguments in order
        for (const arg of expr.args) {
          this.compileExpression(arg);
        }
        // Check if it's a built-in or user function
        if (this.isBuiltin(expr.function)) {
          this.emit(OpCode.BuiltinCall, expr.function, expr.args.length);
        } else if (this.isQuantumGate(expr.function)) {
          this.emit(OpCode.QuantumGate, expr.function, expr.args.length);
        } else {
          this.emit(OpCode.Call, expr.function, expr.args.length);
        }
        break;

      case "Index":
        this.compileExpression(expr.array);
        this.compileExpression(expr.index);
        this.emit(OpCode.LoadIndex);
        break;

      case "ArrayLiteral":
        for (const elem of expr.elements) {
          this.compileExpression(elem);
        }
        this.emit(OpCode.NewArray, expr.elements.length);
        break;

      case "Map":
        this.compileExpression(expr.array);
        this.emit(OpCode.BuiltinCall, `map:${expr.function}`, 1);
        break;
    }
  }

  private binaryOpToOpCode(op: BinaryOp): OpCode {
    switch (op) {
      case BinaryOp.Add:
        return OpCode.Add;
      case BinaryOp.Sub:
        return OpCode.Sub;
      case BinaryOp.Mul:
        return OpCode.Mul;
      case BinaryOp.Div:
        return OpCode.Div;
      case BinaryOp.Mod:
        return OpCode.Mod;
      case BinaryOp.Eq:
        return OpCode.Eq;
      case BinaryOp.Ne:
        return OpCode.Ne;
      case BinaryOp.Lt:
        return OpCode.Lt;
      case BinaryOp.Le:
        return OpCode.Le;
      case BinaryOp.Gt:
        return OpCode.Gt;
      case BinaryOp.Ge:
        return OpCode.Ge;
      case BinaryOp.And:
        return OpCode.And;
      case BinaryOp.Or:
        return OpCode.Or;
    }
  }

  private isBuiltin(name: string): boolean {
    const builtins = [
      "print",
      "println",
      "sqrt",
      "sin",
      "cos",
      "tan",
      "exp",
      "log",
      "abs",
      "floor",
      "ceil",
      "round",
      "min",
      "max",
      "len",
      "random",
    ];
    return builtins.includes(name);
  }

  private isQuantumGate(name: string): boolean {
    const gates = [
      "h",
      "x",
      "y",
      "z",
      "cx",
      "cz",
      "rx",
      "ry",
      "rz",
      "measure",
      "hadamard",
      "pauli_x",
      "pauli_y",
      "pauli_z",
      "cnot",
    ];
    return gates.includes(name);
  }
}
