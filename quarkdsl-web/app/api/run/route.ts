import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import { tmpdir } from "os";

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const {
      code,
      optimize,
      useQuantumComputer,
      ibmApiKey,
      debugMode,
      inputData,
    } = await request.json();

    if (!code) {
      return NextResponse.json(
        { success: false, error: "No code provided" },
        { status: 400 }
      );
    }

    const tempDir = tmpdir();
    const timestamp = Date.now();
    const inputFile = path.join(tempDir, `quarkdsl_${timestamp}.tgpu`);
    const outputFile = path.join(tempDir, `quarkdsl_${timestamp}.py`);

    await fs.writeFile(inputFile, code);

    const projectRoot = path.resolve(process.cwd(), "..");
    const quarkdslBin = path.join(
      projectRoot,
      "target",
      "release",
      "quarkdsl.exe"
    );

    const optimizeFlag = optimize ? "--optimize" : "";
    const compileCommand = `"${quarkdslBin}" compile "${inputFile}" -t orchestrator -o "${outputFile}" ${optimizeFlag}`;

    let compileLogs = "";
    try {
      const { stdout, stderr } = await execAsync(compileCommand, {
        cwd: projectRoot,
        timeout: 30000,
      });
      compileLogs = stdout + stderr;
    } catch (error: any) {
      await fs.unlink(inputFile).catch(() => {});
      return NextResponse.json({
        success: false,
        error: "Compilation failed",
        details:
          error.message +
          "\n" +
          (error.stdout || "") +
          "\n" +
          (error.stderr || ""),
      });
    }

    let compiledCode = "";
    try {
      compiledCode = await fs.readFile(outputFile, "utf-8");
    } catch (error) {
      await fs.unlink(inputFile).catch(() => {});
      return NextResponse.json({
        success: false,
        error: "Failed to read compiled output",
        details: String(error),
      });
    }

    const mainFunctionMatch = compiledCode.match(/def main\(([^)]*)\)/);
    let mainCall = "main()";

    if (mainFunctionMatch && mainFunctionMatch[1].trim()) {
      if (inputData && inputData.trim()) {
        mainCall = `main(${inputData})`;
      } else {
        const params = mainFunctionMatch[1].split(",").map((p) => p.trim());
        const testInputs = params.map((param) => {
          if (param.includes("[")) {
            return "[1.0, 2.0]";
          } else if (param.includes("int")) {
            return "42";
          } else if (param.includes("float")) {
            return "3.14";
          } else {
            return "[1.0, 2.0]";
          }
        });
        mainCall = `main(${testInputs.join(", ")})`;
      }
    }

    const executableCode =
      compiledCode +
      `\n\nif __name__ == "__main__":\n    result = ${mainCall}\n    print(f"Result: {result}")\n`;
    const execFile = path.join(tempDir, `quarkdsl_exec_${timestamp}.py`);
    await fs.writeFile(execFile, executableCode);

    let executionResult = "";
    try {
      const env = {
        ...process.env,
        DEBUG_MODE: debugMode ? "true" : "false",
        USE_QUANTUM_COMPUTER: useQuantumComputer ? "true" : "false",
        IBM_API_KEY: ibmApiKey || "",
        USE_CLOUD_SIMULATOR: "true",
      };

      const timeout = useQuantumComputer ? 300000 : 30000;

      const { stdout, stderr } = await execAsync(`python "${execFile}"`, {
        cwd: projectRoot,
        timeout: timeout,
        env: env,
      });
      executionResult =
        stdout || stderr || "Program executed successfully (no output)";
    } catch (error: any) {
      executionResult = `Execution error:\n${error.message}\n${
        error.stdout || ""
      }\n${error.stderr || ""}`;
    }

    await fs.unlink(execFile).catch(() => {});

    await fs.unlink(inputFile).catch(() => {});
    await fs.unlink(outputFile).catch(() => {});

    return NextResponse.json({
      success: true,
      result: executionResult,
      compiledCode: compiledCode,
      logs: compileLogs,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: "Server error",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
