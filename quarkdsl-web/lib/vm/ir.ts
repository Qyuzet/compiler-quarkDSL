/**
 * QuarkDSL Intermediate Representation (IR)
 * Stack-based bytecode for the VM interpreter
 */

import { Domain } from "./ast";

export enum OpCode {
  // Stack operations
  Push = "Push",
  Pop = "Pop",
  Dup = "Dup",

  // Arithmetic
  Add = "Add",
  Sub = "Sub",
  Mul = "Mul",
  Div = "Div",
  Mod = "Mod",
  Neg = "Neg",

  // Comparison
  Eq = "Eq",
  Ne = "Ne",
  Lt = "Lt",
  Le = "Le",
  Gt = "Gt",
  Ge = "Ge",

  // Logical
  And = "And",
  Or = "Or",
  Not = "Not",

  // Variables
  Load = "Load",
  Store = "Store",
  LoadIndex = "LoadIndex",
  StoreIndex = "StoreIndex",

  // Control flow
  Jump = "Jump",
  JumpIfFalse = "JumpIfFalse",
  Call = "Call",
  Return = "Return",

  // Arrays
  NewArray = "NewArray",
  ArrayLen = "ArrayLen",

  // Built-in functions
  BuiltinCall = "BuiltinCall",

  // Quantum operations
  QuantumGate = "QuantumGate",
  Measure = "Measure",
}

export type Value = number | boolean | Value[];

export interface Instruction {
  op: OpCode;
  operand?: Value | string | number;
  operand2?: Value | string | number;
}

export interface IRFunction {
  name: string;
  params: string[];
  instructions: Instruction[];
  domain: Domain;
}

export interface IRModule {
  functions: Map<string, IRFunction>;
}

