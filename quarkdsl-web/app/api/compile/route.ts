import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, readFile } from "fs/promises";
import path from "path";
import { compile as vmCompile } from "@/lib/vm";

const execAsync = promisify(exec);

// Check if we're in a production/serverless environment
const isProduction =
  process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

export async function POST(request: NextRequest) {
  // In production (Vercel), use the TypeScript VM
  if (isProduction) {
    try {
      const { code, target } = await request.json();

      if (!code) {
        return NextResponse.json(
          { error: "Missing required field: code" },
          { status: 400 }
        );
      }

      const result = vmCompile(code);

      if (!result.success) {
        return NextResponse.json({
          success: false,
          error: result.error || "Compilation failed",
        });
      }

      // Generate pseudo-output based on target
      let output = "";
      if (target === "wgsl") {
        output = generateWGSLStub(result.ast!);
      } else if (target === "qiskit") {
        output = generateQiskitStub(result.ast!);
      } else {
        output = JSON.stringify(result.ir, null, 2);
      }

      return NextResponse.json({
        success: true,
        output,
        logs: "Compiled using QuarkDSL TypeScript VM",
        isVMCompiled: true,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 500 }
      );
    }
  }

  try {
    const { code, target, optimize, dumpIr } = await request.json();

    if (!code || !target) {
      return NextResponse.json(
        { error: "Missing required fields: code and target" },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const inputFile = path.join(process.cwd(), "..", `temp_${timestamp}.tgpu`);
    const outputFile = path.join(
      process.cwd(),
      "..",
      `output_${timestamp}.${target === "wgsl" ? "wgsl" : "py"}`
    );

    await writeFile(inputFile, code, "utf-8");

    const cargoPath = path.join(process.cwd(), "..");
    let command = `cargo run --release -- compile ${inputFile} -t ${target} -o ${outputFile}`;

    // Always enable optimization for production-ready output
    command += " --optimize";

    if (dumpIr) {
      command += " --dump-ir";
    }

    const { stdout, stderr } = await execAsync(command, {
      cwd: cargoPath,
      timeout: 30000,
    });

    const output = await readFile(outputFile, "utf-8");

    await unlink(inputFile);
    await unlink(outputFile);

    return NextResponse.json({
      success: true,
      output,
      logs: stdout,
      errors: stderr,
    });
  } catch (error: any) {
    console.error("Compilation error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Compilation failed",
        details: error.stderr || error.stdout || "",
      },
      { status: 500 }
    );
  }
}

// Generate WGSL stub from AST (simplified output for demo)
function generateWGSLStub(ast: import("@/lib/vm").Program): string {
  const lines: string[] = [
    "// Generated WGSL code from QuarkDSL VM",
    "// Note: This is a simplified representation",
    "",
  ];

  for (const func of ast.functions) {
    if (func.domain === "Gpu" || func.name === "main") {
      lines.push(`// Function: ${func.name}`);
      lines.push(`fn ${func.name}() {`);
      lines.push(`    // ${func.body.length} statements`);
      lines.push(`}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

// Generate Qiskit stub from AST (simplified output for demo)
function generateQiskitStub(ast: import("@/lib/vm").Program): string {
  const lines: string[] = [
    "# Generated Qiskit code from QuarkDSL VM",
    "# Note: This is a simplified representation",
    "",
    "from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister",
    "from qiskit_aer import AerSimulator",
    "",
  ];

  for (const func of ast.functions) {
    if (func.domain === "Quantum" || func.name === "main") {
      lines.push(`# Function: ${func.name}`);
      lines.push(`qr = QuantumRegister(8, 'q')`);
      lines.push(`cr = ClassicalRegister(8, 'c')`);
      lines.push(`circuit = QuantumCircuit(qr, cr)`);
      lines.push("");
      lines.push(`# ${func.body.length} statements in function body`);
      lines.push("");
    }
  }

  lines.push("# Execute circuit");
  lines.push("backend = AerSimulator()");
  lines.push("result = backend.run(circuit, shots=1024).result()");
  lines.push("counts = result.get_counts()");
  lines.push("print(f'Counts: {counts}')");

  return lines.join("\n");
}
