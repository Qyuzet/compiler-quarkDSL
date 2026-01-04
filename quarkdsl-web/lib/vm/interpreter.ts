/**
 * QuarkDSL VM Interpreter
 * Stack-based execution engine for IR bytecode
 */

import { OpCode, Instruction, IRModule, IRFunction, Value } from "./ir";
import { QuantumSimulator } from "./quantum";

export interface ExecutionResult {
  returnValue: Value;
  output: string[];
  quantumCounts?: Map<string, number>;
  gateLog?: string[];
  executionTime: number;
}

interface CallFrame {
  func: IRFunction;
  ip: number;
  locals: Map<string, Value>;
  returnAddress: number;
}

export class Interpreter {
  private module: IRModule;
  private stack: Value[] = [];
  private callStack: CallFrame[] = [];
  private output: string[] = [];
  private quantum: QuantumSimulator;
  private maxIterations: number = 100000;

  constructor(module: IRModule) {
    this.module = module;
    this.quantum = new QuantumSimulator(8);
  }

  execute(entryPoint: string = "main"): ExecutionResult {
    const startTime = performance.now();
    this.stack = [];
    this.callStack = [];
    this.output = [];
    this.quantum.reset();

    const mainFunc = this.module.functions.get(entryPoint);
    if (!mainFunc) {
      throw new Error(`Entry point function '${entryPoint}' not found`);
    }

    this.callStack.push({
      func: mainFunc,
      ip: 0,
      locals: new Map(),
      returnAddress: -1,
    });

    let iterations = 0;
    while (this.callStack.length > 0) {
      if (iterations++ > this.maxIterations) {
        throw new Error("Maximum iteration limit exceeded");
      }

      const frame = this.callStack[this.callStack.length - 1];
      if (frame.ip >= frame.func.instructions.length) {
        // Implicit return
        this.stack.push(0);
        this.callStack.pop();
        continue;
      }

      const inst = frame.func.instructions[frame.ip];
      frame.ip++;

      const shouldReturn = this.executeInstruction(inst, frame);
      if (shouldReturn) {
        break;
      }
    }

    const endTime = performance.now();
    const returnValue = this.stack.length > 0 ? this.stack.pop()! : 0;

    return {
      returnValue,
      output: this.output,
      quantumCounts: this.quantum.sample(1024),
      gateLog: this.quantum.getGateLog(),
      executionTime: endTime - startTime,
    };
  }

  private executeInstruction(inst: Instruction, frame: CallFrame): boolean {
    switch (inst.op) {
      case OpCode.Push:
        this.stack.push(inst.operand as Value);
        break;

      case OpCode.Pop:
        this.stack.pop();
        break;

      case OpCode.Dup:
        if (this.stack.length > 0) {
          this.stack.push(this.stack[this.stack.length - 1]);
        }
        break;

      case OpCode.Load:
        const varName = inst.operand as string;
        const value = frame.locals.get(varName);
        if (value === undefined) {
          throw new Error(`Undefined variable: ${varName}`);
        }
        this.stack.push(value);
        break;

      case OpCode.Store:
        const storeVar = inst.operand as string;
        const storeVal = this.stack.pop()!;
        frame.locals.set(storeVar, storeVal);
        break;

      case OpCode.LoadIndex:
        const idx = this.stack.pop() as number;
        const arr = this.stack.pop() as Value[];
        if (!Array.isArray(arr)) {
          throw new Error("Cannot index non-array value");
        }
        this.stack.push(arr[idx]);
        break;

      case OpCode.StoreIndex:
        const storeValue = this.stack.pop()!;
        const storeIdx = this.stack.pop() as number;
        const storeArr = this.stack.pop() as Value[];
        if (!Array.isArray(storeArr)) {
          throw new Error("Cannot index non-array value");
        }
        storeArr[storeIdx] = storeValue;
        this.stack.push(storeArr);
        break;

      case OpCode.NewArray:
        const size = inst.operand as number;
        const elements: Value[] = [];
        for (let i = 0; i < size; i++) {
          elements.unshift(this.stack.pop()!);
        }
        this.stack.push(elements);
        break;

      // Arithmetic operations
      case OpCode.Add:
      case OpCode.Sub:
      case OpCode.Mul:
      case OpCode.Div:
      case OpCode.Mod:
        this.executeBinaryArithmetic(inst.op);
        break;

      case OpCode.Neg:
        this.stack.push(-(this.stack.pop() as number));
        break;

      // Comparison operations
      case OpCode.Eq:
      case OpCode.Ne:
      case OpCode.Lt:
      case OpCode.Le:
      case OpCode.Gt:
      case OpCode.Ge:
        this.executeComparison(inst.op);
        break;

      // Logical operations
      case OpCode.And:
        const andB = this.stack.pop() as number;
        const andA = this.stack.pop() as number;
        this.stack.push(andA && andB ? 1 : 0);
        break;

      case OpCode.Or:
        const orB = this.stack.pop() as number;
        const orA = this.stack.pop() as number;
        this.stack.push(orA || orB ? 1 : 0);
        break;

      case OpCode.Not:
        this.stack.push(this.stack.pop() ? 0 : 1);
        break;

      // Control flow
      case OpCode.Jump:
        frame.ip = inst.operand as number;
        break;

      case OpCode.JumpIfFalse:
        const cond = this.stack.pop();
        if (!cond) {
          frame.ip = inst.operand as number;
        }
        break;

      case OpCode.Call:
        return this.executeCall(inst, frame);

      case OpCode.Return:
        const retVal = this.stack.pop()!;
        this.callStack.pop();
        this.stack.push(retVal);
        if (this.callStack.length === 0) {
          return true;
        }
        break;

      case OpCode.BuiltinCall:
        this.executeBuiltin(inst.operand as string, inst.operand2 as number);
        break;

      case OpCode.QuantumGate:
        this.executeQuantumGate(
          inst.operand as string,
          inst.operand2 as number
        );
        break;
    }

    return false;
  }

  private executeBinaryArithmetic(op: OpCode): void {
    const b = this.stack.pop() as number;
    const a = this.stack.pop() as number;
    switch (op) {
      case OpCode.Add:
        this.stack.push(a + b);
        break;
      case OpCode.Sub:
        this.stack.push(a - b);
        break;
      case OpCode.Mul:
        this.stack.push(a * b);
        break;
      case OpCode.Div:
        this.stack.push(a / b);
        break;
      case OpCode.Mod:
        this.stack.push(a % b);
        break;
    }
  }

  private executeComparison(op: OpCode): void {
    const b = this.stack.pop() as number;
    const a = this.stack.pop() as number;
    let result: boolean;
    switch (op) {
      case OpCode.Eq:
        result = a === b;
        break;
      case OpCode.Ne:
        result = a !== b;
        break;
      case OpCode.Lt:
        result = a < b;
        break;
      case OpCode.Le:
        result = a <= b;
        break;
      case OpCode.Gt:
        result = a > b;
        break;
      case OpCode.Ge:
        result = a >= b;
        break;
      default:
        result = false;
    }
    this.stack.push(result ? 1 : 0);
  }

  private executeCall(inst: Instruction, frame: CallFrame): boolean {
    const funcName = inst.operand as string;
    const argCount = inst.operand2 as number;
    const func = this.module.functions.get(funcName);

    if (!func) {
      throw new Error(`Undefined function: ${funcName}`);
    }

    const args: Value[] = [];
    for (let i = 0; i < argCount; i++) {
      args.unshift(this.stack.pop()!);
    }

    const newLocals = new Map<string, Value>();
    for (let i = 0; i < func.params.length && i < args.length; i++) {
      newLocals.set(func.params[i], args[i]);
    }

    this.callStack.push({
      func,
      ip: 0,
      locals: newLocals,
      returnAddress: frame.ip,
    });

    return false;
  }

  private executeBuiltin(name: string, argCount: number): void {
    const args: Value[] = [];
    for (let i = 0; i < argCount; i++) {
      args.unshift(this.stack.pop()!);
    }

    switch (name) {
      case "print":
        this.output.push(args.map((a) => this.formatValue(a)).join(" "));
        this.stack.push(0);
        break;

      case "println":
        this.output.push(args.map((a) => this.formatValue(a)).join(" "));
        this.stack.push(0);
        break;

      case "sqrt":
        this.stack.push(Math.sqrt(args[0] as number));
        break;

      case "sin":
        this.stack.push(Math.sin(args[0] as number));
        break;

      case "cos":
        this.stack.push(Math.cos(args[0] as number));
        break;

      case "tan":
        this.stack.push(Math.tan(args[0] as number));
        break;

      case "exp":
        this.stack.push(Math.exp(args[0] as number));
        break;

      case "log":
        this.stack.push(Math.log(args[0] as number));
        break;

      case "abs":
        this.stack.push(Math.abs(args[0] as number));
        break;

      case "floor":
        this.stack.push(Math.floor(args[0] as number));
        break;

      case "ceil":
        this.stack.push(Math.ceil(args[0] as number));
        break;

      case "round":
        this.stack.push(Math.round(args[0] as number));
        break;

      case "min":
        this.stack.push(Math.min(args[0] as number, args[1] as number));
        break;

      case "max":
        this.stack.push(Math.max(args[0] as number, args[1] as number));
        break;

      case "len":
        this.stack.push((args[0] as Value[]).length);
        break;

      case "random":
        this.stack.push(Math.random());
        break;

      default:
        if (name.startsWith("map:")) {
          const funcName = name.slice(4);
          const array = args[0] as Value[];
          const result = array.map((elem) => {
            const func = this.module.functions.get(funcName);
            if (!func) {
              throw new Error(`Undefined function: ${funcName}`);
            }
            // Simple inline execution for map
            this.stack.push(elem);
            this.callStack.push({
              func,
              ip: 0,
              locals: new Map([[func.params[0], elem]]),
              returnAddress: -1,
            });
            // Execute until return
            while (this.callStack.length > 0) {
              const frame = this.callStack[this.callStack.length - 1];
              if (frame.ip >= frame.func.instructions.length) {
                this.callStack.pop();
                break;
              }
              const inst = frame.func.instructions[frame.ip];
              frame.ip++;
              if (this.executeInstruction(inst, frame)) {
                break;
              }
            }
            return this.stack.pop()!;
          });
          this.stack.push(result);
        } else {
          throw new Error(`Unknown builtin: ${name}`);
        }
    }
  }

  private executeQuantumGate(name: string, argCount: number): void {
    const args: Value[] = [];
    for (let i = 0; i < argCount; i++) {
      args.unshift(this.stack.pop()!);
    }

    switch (name) {
      case "h":
      case "hadamard":
        this.quantum.h(args[0] as number);
        this.stack.push(0);
        break;

      case "x":
      case "pauli_x":
        this.quantum.x(args[0] as number);
        this.stack.push(0);
        break;

      case "y":
      case "pauli_y":
        this.quantum.y(args[0] as number);
        this.stack.push(0);
        break;

      case "z":
      case "pauli_z":
        this.quantum.z(args[0] as number);
        this.stack.push(0);
        break;

      case "cx":
      case "cnot":
        this.quantum.cx(args[0] as number, args[1] as number);
        this.stack.push(0);
        break;

      case "cz":
        this.quantum.cz(args[0] as number, args[1] as number);
        this.stack.push(0);
        break;

      case "rx":
        this.quantum.rx(args[1] as number, args[0] as number);
        this.stack.push(0);
        break;

      case "ry":
        this.quantum.ry(args[1] as number, args[0] as number);
        this.stack.push(0);
        break;

      case "rz":
        this.quantum.rz(args[1] as number, args[0] as number);
        this.stack.push(0);
        break;

      case "measure":
        const result = this.quantum.measure(args[0] as number);
        this.stack.push(result);
        break;

      default:
        throw new Error(`Unknown quantum gate: ${name}`);
    }
  }

  private formatValue(value: Value): string {
    if (Array.isArray(value)) {
      return `[${value.map((v) => this.formatValue(v)).join(", ")}]`;
    }
    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }
    return String(value);
  }
}
