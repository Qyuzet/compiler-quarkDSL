/**
 * QuarkDSL Virtual Machine
 * Main entry point for parsing, compiling, and executing QuarkDSL code
 */

import { Lexer } from "./lexer";
import { Parser } from "./parser";
import { Compiler } from "./compiler";
import { Interpreter, ExecutionResult } from "./interpreter";
import { Program } from "./ast";
import { IRModule } from "./ir";

export interface CompilationResult {
  success: boolean;
  ast?: Program;
  ir?: IRModule;
  error?: string;
}

export interface VMExecutionResult extends ExecutionResult {
  success: boolean;
  error?: string;
}

/**
 * Compile QuarkDSL source code to IR
 */
export function compile(source: string): CompilationResult {
  try {
    // Lexical analysis
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();

    // Parsing
    const parser = new Parser(tokens);
    const ast = parser.parse();

    // IR generation
    const compiler = new Compiler();
    const ir = compiler.compile(ast);

    return {
      success: true,
      ast,
      ir,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Execute QuarkDSL source code
 */
export function execute(source: string, entryPoint: string = "main"): VMExecutionResult {
  try {
    const compilation = compile(source);
    if (!compilation.success || !compilation.ir) {
      return {
        success: false,
        error: compilation.error || "Compilation failed",
        returnValue: 0,
        output: [],
        executionTime: 0,
      };
    }

    const interpreter = new Interpreter(compilation.ir);
    const result = interpreter.execute(entryPoint);

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      returnValue: 0,
      output: [],
      executionTime: 0,
    };
  }
}

/**
 * Format execution result for display
 */
export function formatResult(result: VMExecutionResult): string {
  const lines: string[] = [];

  if (!result.success) {
    lines.push(`Error: ${result.error}`);
    return lines.join("\n");
  }

  // Output from print statements
  if (result.output.length > 0) {
    lines.push("=== Output ===");
    lines.push(...result.output);
    lines.push("");
  }

  // Return value
  lines.push(`=== Result ===`);
  lines.push(`Return value: ${formatValue(result.returnValue)}`);
  lines.push(`Execution time: ${result.executionTime.toFixed(2)}ms`);

  // Quantum results
  if (result.gateLog && result.gateLog.length > 0) {
    lines.push("");
    lines.push("=== Quantum Circuit ===");
    lines.push(result.gateLog.join(" -> "));
  }

  if (result.quantumCounts && result.quantumCounts.size > 0) {
    lines.push("");
    lines.push("=== Quantum Measurement Results (1024 shots) ===");
    const sorted = Array.from(result.quantumCounts.entries()).sort(
      (a, b) => b[1] - a[1]
    );
    for (const [state, count] of sorted.slice(0, 10)) {
      const percentage = ((count / 1024) * 100).toFixed(1);
      lines.push(`  |${state}>: ${count} (${percentage}%)`);
    }
  }

  return lines.join("\n");
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((v) => formatValue(v)).join(", ")}]`;
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}

// Re-export types
export type { ExecutionResult } from "./interpreter";
export type { Program, Function, Statement, Expression } from "./ast";
export type { IRModule, IRFunction, Instruction } from "./ir";

