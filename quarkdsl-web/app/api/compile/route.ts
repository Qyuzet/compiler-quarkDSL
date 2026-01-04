import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, readFile } from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
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
