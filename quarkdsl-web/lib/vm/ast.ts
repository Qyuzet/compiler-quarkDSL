/**
 * QuarkDSL Abstract Syntax Tree (AST) Types
 * Represents the hierarchical structure of parsed programs
 */

export enum Domain {
  Classical = "Classical",
  Gpu = "Gpu",
  Quantum = "Quantum",
}

export enum TypeKind {
  Int = "Int",
  Float = "Float",
  Bool = "Bool",
  Qubit = "Qubit",
  Void = "Void",
  QState = "QState",
  Array = "Array",
  Tensor = "Tensor",
}

export interface Type {
  kind: TypeKind;
  elementType?: Type;
  size?: number;
}

export interface Param {
  name: string;
  ty: Type;
}

export interface Function {
  name: string;
  params: Param[];
  returnType: Type;
  body: Statement[];
  domain: Domain;
}

export interface Program {
  functions: Function[];
}

export enum BinaryOp {
  Add = "Add",
  Sub = "Sub",
  Mul = "Mul",
  Div = "Div",
  Mod = "Mod",
  Eq = "Eq",
  Ne = "Ne",
  Lt = "Lt",
  Le = "Le",
  Gt = "Gt",
  Ge = "Ge",
  And = "And",
  Or = "Or",
}

export enum UnaryOp {
  Neg = "Neg",
  Not = "Not",
}

export type Expression =
  | { kind: "IntLiteral"; value: number }
  | { kind: "FloatLiteral"; value: number }
  | { kind: "BoolLiteral"; value: boolean }
  | { kind: "Variable"; name: string }
  | { kind: "Binary"; op: BinaryOp; left: Expression; right: Expression }
  | { kind: "Unary"; op: UnaryOp; operand: Expression }
  | { kind: "Call"; function: string; args: Expression[] }
  | { kind: "Index"; array: Expression; index: Expression }
  | { kind: "ArrayLiteral"; elements: Expression[] }
  | { kind: "Map"; function: string; array: Expression };

export type Statement =
  | { kind: "Let"; name: string; ty?: Type; value: Expression }
  | { kind: "Assign"; target: string; index?: Expression; value: Expression }
  | { kind: "Return"; value: Expression }
  | { kind: "Expression"; expr: Expression }
  | { kind: "For"; var: string; start: Expression; end: Expression; body: Statement[] }
  | { kind: "If"; condition: Expression; thenBody: Statement[]; elseBody?: Statement[] };

