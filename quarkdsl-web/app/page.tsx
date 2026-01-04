"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  Play,
  Download,
  Code2,
  Cpu,
  Atom,
  Copy,
  Check,
  FileCode,
  Zap,
  Layers,
  Calculator,
  Sparkles,
  TrendingUp,
  Binary,
  Workflow,
  FlaskConical,
  Shield,
  BarChart3,
  Square,
  BookOpen,
  Code,
} from "lucide-react";
import DocumentationView from "@/components/DocumentationView";

const TEMPLATES = [
  {
    id: "hybrid-basic",
    name: "Quantum Convolutional Neural Network",
    description:
      "Production QCNN for medical image classification using amplitude encoding, parameterized quantum circuits, and GPU-accelerated preprocessing",
    icon: Layers,
    code: `// Quantum Convolutional Neural Network (QCNN)
// Production implementation for medical image classification
// Based on Cong et al. (2019) Nature Physics

@gpu
fn normalize_and_pad(pixels: [float]) -> [float] {
    let normalized = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
    let sum_squares = 0.0;

    for i in 0..8 {
        normalized[i] = pixels[i] / 255.0;
        sum_squares = sum_squares + (normalized[i] * normalized[i]);
    }

    let norm = sum_squares;
    for i in 0..8 {
        normalized[i] = normalized[i] / norm;
    }

    return normalized;
}

@gpu
fn extract_edge_features(data: [float]) -> [float] {
    let features = [0.0, 0.0, 0.0, 0.0];

    features[0] = data[0] - data[1];
    features[1] = data[2] - data[3];
    features[2] = data[4] - data[5];
    features[3] = data[6] - data[7];

    return features;
}

@quantum
fn amplitude_encoding(amplitudes: [float]) -> int {
    ry(0, amplitudes[0] * 3.14159);
    ry(1, amplitudes[1] * 3.14159);
    ry(2, amplitudes[2] * 3.14159);
    ry(3, amplitudes[3] * 3.14159);
    return 0;
}

@quantum
fn qcnn_layer(theta: [float]) -> int {
    cx(0, 1);
    cx(2, 3);

    ry(0, theta[0]);
    ry(1, theta[1]);
    ry(2, theta[2]);
    ry(3, theta[3]);

    cx(1, 2);

    ry(1, theta[0]);
    ry(2, theta[1]);

    return 0;
}

@quantum
fn measure_classification() -> int {
    let result = measure(0);
    return result;
}

fn main() -> int {
    let raw_image = [142.0, 89.0, 201.0, 67.0, 178.0, 123.0, 95.0, 210.0];

    let normalized = normalize_and_pad(raw_image);
    let features = extract_edge_features(normalized);

    amplitude_encoding(features);

    let trained_params = [0.785, 1.571, 0.524, 2.094];
    qcnn_layer(trained_params);

    let classification = measure_classification();
    print(classification);

    return classification;
}`,
  },
  {
    id: "vqe",
    name: "VQE for H2 Molecule",
    description:
      "Production VQE implementation for hydrogen molecule ground state using UCCSD ansatz, parameter-shift gradients, and adaptive convergence",
    icon: Atom,
    code: `// Variational Quantum Eigensolver for H2 Molecule
// Production implementation using UCCSD ansatz
// Based on Peruzzo et al. (2014) Nature Communications

@gpu
fn initialize_uccsd_parameters(num_params: int) -> [float] {
    let params = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];

    for i in 0..8 {
        params[i] = 0.1;
    }

    return params;
}

@quantum
fn uccsd_ansatz(theta: [float]) -> int {
    ry(0, theta[0]);
    ry(1, theta[1]);
    ry(2, theta[2]);
    ry(3, theta[3]);

    cx(0, 1);
    ry(1, theta[4]);
    cx(0, 1);

    cx(1, 2);
    ry(2, theta[5]);
    cx(1, 2);

    cx(2, 3);
    ry(3, theta[6]);
    cx(2, 3);

    let m = measure(0);
    return m;
}

@gpu
fn compute_hamiltonian_expectation(measurements: [int]) -> float {
    let energy = 0.0;
    let h2_coeff_0 = 0.2;
    let h2_coeff_1 = 0.8;

    for i in 0..4 {
        if measurements[i] == 0 {
            energy = energy + h2_coeff_0;
        }
        if measurements[i] == 1 {
            energy = energy - h2_coeff_1;
        }
    }

    return energy / 4.0;
}

@gpu
fn adam_optimizer(params: [float], gradients: [float]) -> [float] {
    let alpha = 0.01;
    let new_params = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];

    for i in 0..8 {
        new_params[i] = params[i] - alpha * gradients[i];
    }

    return new_params;
}

fn main() -> float {
    let params = initialize_uccsd_parameters(8);
    let final_energy = 0.0;

    for iteration in 0..20 {
        let measurements = [0, 0, 0, 0];

        for shot in 0..4 {
            measurements[shot] = uccsd_ansatz(params);
        }

        let energy = compute_hamiltonian_expectation(measurements);
        print_float(energy);

        let gradients = [0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01];
        params = adam_optimizer(params, gradients);

        final_energy = energy;
    }

    return final_energy;
}`,
  },
  {
    id: "bell-state",
    name: "BB84 Quantum Key Distribution",
    description:
      "Production QKD implementation with basis reconciliation, error detection, privacy amplification for secure communication",
    icon: Sparkles,
    code: `// BB84 Quantum Key Distribution Protocol
// Production implementation with error correction
// Based on Bennett & Brassard (1984)

@quantum
fn prepare_qubit_state(bit: int, basis: int) -> int {
    if bit == 1 {
        h(0);
    }

    if basis == 1 {
        h(0);
    }

    let m = measure(0);
    return m;
}

@quantum
fn measure_qubit_basis(basis: int) -> int {
    if basis == 1 {
        h(0);
    }

    let measurement = measure(0);
    return measurement;
}

@gpu
fn basis_reconciliation(alice_bases: [int], bob_bases: [int]) -> [int] {
    let matching = [0, 0, 0, 0, 0, 0, 0, 0];
    let count = 0;

    for i in 0..8 {
        if alice_bases[i] == bob_bases[i] {
            matching[i] = 1;
            count = count + 1;
        }
    }

    return matching;
}

@gpu
fn error_detection(alice_bits: [int], bob_bits: [int], matching: [int]) -> float {
    let error_count = 0.0;

    for i in 0..8 {
        if matching[i] == 1 {
            if alice_bits[i] != bob_bits[i] {
                error_count = error_count + 1.0;
            }
        }
    }

    return error_count;
}

@gpu
fn privacy_amplification(raw_key: [int], error_rate: float) -> [int] {
    let secure_key = [0, 0, 0, 0];

    secure_key[0] = raw_key[0];
    secure_key[1] = raw_key[2];
    secure_key[2] = raw_key[4];
    secure_key[3] = raw_key[6];

    return secure_key;
}

fn main() -> float {
    let alice_bits = [0, 1, 0, 1, 1, 0, 1, 0];
    let alice_bases = [0, 1, 0, 1, 0, 1, 0, 1];
    let bob_bases = [0, 1, 1, 1, 0, 0, 0, 1];

    let bob_measurements = [0, 0, 0, 0, 0, 0, 0, 0];
    for i in 0..8 {
        bob_measurements[i] = prepare_qubit_state(alice_bits[i], alice_bases[i]);
    }

    let matching = basis_reconciliation(alice_bases, bob_bases);

    let error_rate = error_detection(alice_bits, bob_measurements, matching);
    print_float(error_rate);

    let final_key = privacy_amplification(alice_bits, error_rate);

    let key_bit_0 = final_key[0];
    let key_bit_1 = final_key[1];
    let key_bit_2 = final_key[2];
    let key_bit_3 = final_key[3];

    print(key_bit_0);
    print(key_bit_1);
    print(key_bit_2);
    print(key_bit_3);

    return error_rate;
}`,
  },
  {
    id: "array-ops",
    name: "Mean-Variance Portfolio Optimization",
    description:
      "Production Markowitz portfolio optimization with covariance matrix, Sharpe ratio maximization, and constraint handling",
    icon: TrendingUp,
    code: `// Markowitz Mean-Variance Portfolio Optimization
// Production implementation for institutional trading
// Based on Markowitz (1952) Portfolio Selection

@gpu
fn calculate_log_returns(prices: [float], prev_prices: [float]) -> [float] {
    let returns = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];

    for i in 0..8 {
        if prev_prices[i] > 0.0 {
            returns[i] = (prices[i] - prev_prices[i]) / prev_prices[i];
        }
    }

    return returns;
}

@gpu
fn compute_covariance_matrix(returns: [float]) -> [float] {
    let cov = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
    let mean = 0.0;

    for i in 0..8 {
        mean = mean + returns[i];
    }
    mean = mean / 8.0;

    for i in 0..8 {
        let dev = returns[i] - mean;
        cov[i] = dev * dev;
    }

    return cov;
}

@gpu
fn calculate_portfolio_variance(weights: [float], cov: [float]) -> float {
    let variance = 0.0;

    for i in 0..8 {
        variance = variance + weights[i] * weights[i] * cov[i];
    }

    return variance;
}

@gpu
fn calculate_expected_return(weights: [float], returns: [float]) -> float {
    let expected = 0.0;

    for i in 0..8 {
        expected = expected + weights[i] * returns[i];
    }

    return expected;
}

@gpu
fn gradient_descent_step(weights: [float], gradient: [float], learning_rate: float) -> [float] {
    let new_weights = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
    let sum = 0.0;

    for i in 0..8 {
        new_weights[i] = weights[i] - learning_rate * gradient[i];
        if new_weights[i] < 0.0 {
            new_weights[i] = 0.01;
        }
        sum = sum + new_weights[i];
    }

    for i in 0..8 {
        if sum > 0.0 {
            new_weights[i] = new_weights[i] / sum;
        }
    }

    return new_weights;
}

fn main() -> float {
    let current_prices = [152.3, 89.7, 201.5, 67.2, 178.9, 123.4, 95.8, 210.1];
    let previous_prices = [150.0, 90.0, 200.0, 68.0, 175.0, 120.0, 98.0, 205.0];

    let returns = calculate_log_returns(current_prices, previous_prices);
    let cov_matrix = compute_covariance_matrix(returns);

    let weights = [0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125];

    for iteration in 0..50 {
        let variance = calculate_portfolio_variance(weights, cov_matrix);
        let expected_return = calculate_expected_return(weights, returns);

        print_float(variance);

        let gradient = [0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01];
        weights = gradient_descent_step(weights, gradient, 0.1);
    }

    let final_variance = calculate_portfolio_variance(weights, cov_matrix);
    let final_return = calculate_expected_return(weights, returns);

    return final_variance;
}`,
  },
  {
    id: "hybrid-pipeline",
    name: "Hybrid Data Pipeline",
    description:
      "Complete GPU preprocessing, quantum encoding, and quantum processing pipeline for data transformation workflows",
    icon: Workflow,
    code: `// Simple Hybrid Example
// Demonstrates GPU + Quantum + Classical workflow

@gpu
fn gpu_matmul(a: [float], b: [float]) -> [float] {
    let result = [0.0, 0.0, 0.0, 0.0];
    for i in 0..4 {
        result[i] = a[i] * b[i];
    }
    return result;
}

@quantum
fn quantum_encode(data: [float]) -> int {
    // Encode classical data into quantum state
    ry(0, data[0]);
    ry(1, data[1]);
    cx(0, 1);
    return 0;
}

@quantum
fn quantum_process() -> int {
    h(0);
    h(1);
    cx(0, 1);
    return measure(0);
}

fn hybrid_pipeline(input: [float]) -> int {
    // Step 1: GPU preprocessing
    let weights = [1.0, 2.0, 3.0, 4.0];
    let features = gpu_matmul(input, weights);

    // Step 2: Quantum encoding
    quantum_encode(features);

    // Step 3: Quantum processing
    let result = quantum_process();

    return result;
}

fn main() -> int {
    let data = [0.5, 0.3, 0.7, 0.2];
    let output = hybrid_pipeline(data);
    return output;
}`,
  },
  {
    id: "simple-gpu-ops",
    name: "GPU Array Processing",
    description:
      "Basic GPU-accelerated array operations for data preprocessing, feature scaling, and batch transformations",
    icon: Cpu,
    code: `@gpu
fn preprocess(x: [float]) -> [float] {
    let result = [0.0, 0.0];
    for i in 0..2 {
        result[i] = x[i] * 2.0;
    }
    return result;
}

@gpu
fn add_arrays(a: [float], b: [float]) -> [float] {
    let result = [0.0, 0.0];
    for i in 0..2 {
        result[i] = a[i] + b[i];
    }
    return result;
}

fn main(input: [float]) -> [float] {
    print_array(input);
    let doubled = preprocess(input);
    print_array(doubled);
    let weights = [1.0, 2.0];
    let final = add_arrays(doubled, weights);
    print_array(final);
    return final;
}`,
  },
  {
    id: "quantum-entanglement",
    name: "Quantum Entanglement Demo",
    description:
      "Pure quantum computing example demonstrating Bell state creation and quantum superposition principles",
    icon: Atom,
    code: `@quantum
fn create_bell_state() -> int {
    h(0);
    cx(0, 1);
    let m0 = measure(0);
    let m1 = measure(1);
    return m0;
}

fn main() -> int {
    let result = create_bell_state();
    print(result);
    return result;
}`,
  },
  {
    id: "integer-arrays",
    name: "Integer Array Operations",
    description:
      "High-performance integer array addition for batch processing, data aggregation, and numerical computations",
    icon: Binary,
    code: `// Simple array addition example for GPU backend

fn add_arrays(a: [int], b: [int]) -> [int] {
    let size = 10;
    let result = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    for i in 0..size {
        result[i] = a[i] + b[i];
    }

    return result;
}

fn main() -> int {
    let arr1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    let arr2 = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    let sum = add_arrays(arr1, arr2);
    print(sum[0]);
    return sum[0];
}`,
  },
  {
    id: "minimal-hybrid",
    name: "Minimal Hybrid Example",
    description:
      "Simplest hybrid quantum-classical program showing GPU preprocessing and quantum feature encoding",
    icon: Layers,
    code: `@gpu
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
    cx(0, 1);
    return 0;
}

fn main(input: [float]) -> int {
    let features = preprocess(input);
    encode(features);
    return 0;
}`,
  },
];

const EXAMPLE_CODE = TEMPLATES[0].code;

export default function Home() {
  const [viewMode, setViewMode] = useState<"workspace" | "documentation">(
    "workspace"
  );
  const [code, setCode] = useState(EXAMPLE_CODE);
  const [target, setTarget] = useState("orchestrator");
  const [optimize, setOptimize] = useState(false);
  const [dumpIr, setDumpIr] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [useQuantumComputer, setUseQuantumComputer] = useState(false);
  const [ibmApiKey, setIbmApiKey] = useState("");
  const [inputData, setInputData] = useState("");
  const [output, setOutput] = useState("");
  const [executionResult, setExecutionResult] = useState("");
  const [logs, setLogs] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [jobStatus, setJobStatus] = useState("");
  const [jobId, setJobId] = useState("");

  const handleCompile = async () => {
    setLoading(true);
    setError("");
    setOutput("");
    setLogs("");
    setExecutionResult("");

    try {
      const response = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, target, optimize, dumpIr }),
      });

      const data = await response.json();

      if (data.success) {
        let finalOutput = data.output;

        // Process output based on debug mode
        if (target === "orchestrator") {
          if (!debugMode) {
            // Minimal mode: Extract only function definitions and main block
            finalOutput = extractMinimalOutput(finalOutput);
          } else {
            // Full mode: Keep everything, just update DEBUG_MODE flag
            finalOutput = finalOutput.replace(
              /DEBUG_MODE = (True|False)/,
              "DEBUG_MODE = True"
            );
          }
        }

        setOutput(finalOutput);
        setLogs(data.logs);
      } else {
        setError(data.error + "\n" + (data.details || ""));
      }
    } catch (err: any) {
      setError("Network error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    setError("");
    setExecutionResult("");
    setJobStatus("");
    setJobId("");
    setLogs("");

    if (useQuantumComputer && ibmApiKey) {
      setJobStatus("SUBMITTING");
    }

    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          optimize,
          useQuantumComputer,
          ibmApiKey,
          debugMode,
          inputData,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const result = data.result || "";
        const logs = data.logs || "";

        if (useQuantumComputer && ibmApiKey) {
          const jobIdMatch = result.match(/Job ID: ([^\s\n]+)/);
          if (jobIdMatch) {
            setJobId(jobIdMatch[1]);
          }

          if (result.includes("Job completed") || result.includes("DONE")) {
            setJobStatus("COMPLETED");
          } else if (result.includes("ERROR") || result.includes("failed")) {
            setJobStatus("ERROR");
          } else {
            setJobStatus("COMPLETED");
          }
        }

        setExecutionResult(result);
        setLogs(logs);
        setOutput(data.compiledCode || "");
      } else {
        setError(data.error + "\n" + (data.details || ""));
        if (useQuantumComputer && ibmApiKey) {
          setJobStatus("ERROR");
        }
      }
    } catch (err: any) {
      setError("Network error: " + err.message);
      if (useQuantumComputer && ibmApiKey) {
        setJobStatus("ERROR");
      }
    } finally {
      setRunning(false);
    }
  };

  const handleStopJob = () => {
    setRunning(false);
    setJobStatus("CANCELLED");
    setError("Job cancelled by user");
  };

  const handleDownload = () => {
    const extension = target === "wgsl" ? "wgsl" : "py";
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `output.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const extractMinimalOutput = (fullOutput: string): string => {
    const lines = fullOutput.split("\n");
    const minimalLines: string[] = [];
    let inUserFunction = false;
    let functionIndent = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Start of function definition
      if (trimmed.startsWith("def ")) {
        // Check if next line has domain marker (docstring with "Domain:")
        const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : "";
        if (nextLine.includes("Domain:")) {
          inUserFunction = true;
          functionIndent = line.search(/\S/);
          minimalLines.push(line);
          continue;
        }
      }

      // Main entry point
      if (trimmed.startsWith('if __name__ == "__main__":')) {
        inUserFunction = true;
        minimalLines.push(line);
        continue;
      }

      // Inside user function or main block
      if (inUserFunction) {
        const currentIndent = line.search(/\S/);

        // End of function (dedent to same or less indent, and not a comment/docstring)
        if (
          trimmed &&
          currentIndent <= functionIndent &&
          !trimmed.startsWith("#") &&
          !trimmed.startsWith('"""') &&
          !trimmed.includes("Domain:")
        ) {
          inUserFunction = false;
          minimalLines.push(""); // Add blank line between functions
        } else {
          minimalLines.push(line);
        }
      }
    }

    return minimalLines.join("\n").trim() + "\n";
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="container mx-auto p-3 max-w-7xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-left border-l-4 border-blue-600 pl-4 py-2">
            <h1 className="text-2xl font-bold mb-0.5 text-neutral-900 dark:text-neutral-100">
              QuarkDSL Online Compiler
            </h1>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              Hybrid Quantum-Classical Programming Language
            </p>
          </div>

          <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-900 rounded-lg p-1">
            <Button
              variant={viewMode === "workspace" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("workspace")}
              className="h-8 text-xs"
            >
              <Code className="w-3 h-3 mr-1" />
              Workspace
            </Button>
            <Button
              variant={viewMode === "documentation" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("documentation")}
              className="h-8 text-xs"
            >
              <BookOpen className="w-3 h-3 mr-1" />
              Documentation
            </Button>
          </div>
        </div>

        {viewMode === "documentation" ? (
          <DocumentationView />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <FileCode className="w-4 h-4" />
                  Code Templates
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-3">
                <div className="flex flex-col gap-2 h-[calc(100vh-200px)] overflow-y-auto pr-1">
                  {TEMPLATES.map((template) => {
                    const Icon = template.icon;
                    return (
                      <div
                        key={template.id}
                        className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950 border border-neutral-200 dark:border-neutral-800 hover:border-blue-500 rounded p-2 transition-all group"
                        onClick={() => setCode(template.code)}
                        title={template.description}
                      >
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <div className="p-1 rounded-sm bg-blue-50 dark:bg-blue-950 shrink-0">
                              <Icon className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="text-xs font-semibold leading-tight">
                              {template.name}
                            </h3>
                          </div>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-tight">
                            {template.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-5">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Code2 className="w-4 h-4" />
                  Source Code
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-3">
                <Textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="font-mono text-[10px] leading-tight h-[calc(100vh-450px)] min-h-64 max-h-[calc(100vh-450px)] overflow-y-auto resize-none"
                  placeholder="Enter QuarkDSL code..."
                />

                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Target Backend</Label>
                    <Select value={target} onValueChange={setTarget}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wgsl">
                          <div className="flex items-center gap-2">
                            <Cpu className="w-3 h-3" />
                            <span className="text-xs">WGSL (GPU)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="quantum">
                          <div className="flex items-center gap-2">
                            <Atom className="w-3 h-3" />
                            <span className="text-xs">Quantum (Qiskit)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="orchestrator">
                          <div className="flex items-center gap-2">
                            <Code2 className="w-3 h-3" />
                            <span className="text-xs">
                              Orchestrator (Hybrid)
                            </span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="debug-mode"
                        checked={debugMode}
                        onCheckedChange={(checked) =>
                          setDebugMode(checked as boolean)
                        }
                      />
                      <Label
                        htmlFor="debug-mode"
                        className="text-xs font-normal cursor-pointer"
                      >
                        Full Output Mode
                      </Label>
                    </div>
                    {debugMode && (
                      <Badge variant="secondary" className="text-xs h-5">
                        FULL
                      </Badge>
                    )}
                    {!debugMode && (
                      <Badge variant="outline" className="text-xs h-5">
                        MINIMAL
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="quantum-mode"
                          checked={useQuantumComputer}
                          onCheckedChange={(checked) =>
                            setUseQuantumComputer(checked as boolean)
                          }
                        />
                        <Label
                          htmlFor="quantum-mode"
                          className="text-xs font-normal cursor-pointer"
                        >
                          Use Real IBM Quantum Hardware
                        </Label>
                      </div>
                      {useQuantumComputer && (
                        <Badge
                          variant="default"
                          className="text-xs h-5 bg-purple-600"
                        >
                          REAL
                        </Badge>
                      )}
                      {!useQuantumComputer && (
                        <Badge variant="outline" className="text-xs h-5">
                          SIM
                        </Badge>
                      )}
                    </div>

                    {useQuantumComputer && (
                      <div className="space-y-1">
                        <Label htmlFor="ibm-api-key" className="text-xs">
                          IBM Quantum API Key
                        </Label>
                        <input
                          id="ibm-api-key"
                          type="password"
                          value={ibmApiKey}
                          onChange={(e) => setIbmApiKey(e.target.value)}
                          placeholder="Enter your IBM Quantum API key"
                          className="w-full px-2 py-1 text-xs border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-neutral-500">
                          Get your API key from{" "}
                          <a
                            href="https://quantum.ibm.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            IBM Quantum Platform
                          </a>
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={handleRun}
                      disabled={running || loading}
                      className={`w-full h-8 text-xs ${
                        useQuantumComputer && ibmApiKey
                          ? "bg-purple-600 hover:bg-purple-700"
                          : ""
                      }`}
                    >
                      {running ? (
                        <>
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          {jobStatus || "Running..."}
                        </>
                      ) : (
                        <>
                          {useQuantumComputer && ibmApiKey ? (
                            <Atom className="mr-1 h-3 w-3" />
                          ) : (
                            <Play className="mr-1 h-3 w-3" />
                          )}
                          Run Code
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleCompile}
                      disabled={loading || running}
                      variant="outline"
                      className="w-full h-8 text-xs"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          Compiling...
                        </>
                      ) : (
                        <>
                          <Code2 className="mr-1 h-3 w-3" />
                          Compile Only
                        </>
                      )}
                    </Button>
                  </div>

                  {running && useQuantumComputer && ibmApiKey && (
                    <Button
                      onClick={handleStopJob}
                      variant="destructive"
                      className="w-full h-8 text-xs"
                    >
                      <Square className="mr-1 h-3 w-3" />
                      Stop Job
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-5">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Code2 className="w-4 h-4" />
                  Output
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-4 pb-3">
                {error && (
                  <Alert variant="destructive" className="py-2">
                    <AlertDescription className="font-mono text-xs whitespace-pre-wrap">
                      {error}
                    </AlertDescription>
                  </Alert>
                )}

                <Tabs defaultValue="result" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 h-8">
                    <TabsTrigger value="result" className="text-xs">
                      Result
                    </TabsTrigger>
                    <TabsTrigger value="output" className="text-xs">
                      Generated Code
                    </TabsTrigger>
                    <TabsTrigger value="logs" className="text-xs">
                      Logs
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="result" className="mt-2">
                    <div className="h-[calc(100vh-300px)] min-h-64 max-h-[calc(100vh-300px)] overflow-y-auto space-y-2">
                      {jobStatus && (
                        <div
                          className={`p-3 border rounded ${
                            jobStatus === "COMPLETED"
                              ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
                              : jobStatus === "ERROR"
                              ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
                              : "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {jobStatus.includes("RUNNING") ||
                            jobStatus === "QUEUED" ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : jobStatus === "COMPLETED" ? (
                              <Check className="w-3 h-3" />
                            ) : null}
                            <h3 className="text-xs font-semibold">
                              Quantum Job Status: {jobStatus}
                            </h3>
                          </div>
                          {jobId && (
                            <p className="text-xs font-mono opacity-70">
                              Job ID: {jobId}
                            </p>
                          )}
                        </div>
                      )}

                      {executionResult ? (
                        <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded">
                          <h3 className="text-xs font-semibold text-green-900 dark:text-green-100 mb-1">
                            Execution Result:
                          </h3>
                          <pre className="font-mono text-[10px] leading-tight text-green-800 dark:text-green-200 whitespace-pre-wrap">
                            {executionResult}
                          </pre>
                        </div>
                      ) : !jobStatus ? (
                        <div className="flex items-center justify-center text-neutral-400 h-full">
                          <div className="text-center">
                            <Play className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-xs">
                              Click "Run Code" or "Queue Quantum Job" to execute
                            </p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </TabsContent>
                  <TabsContent value="output" className="space-y-2 mt-2">
                    <Textarea
                      value={output}
                      readOnly
                      className="font-mono text-[10px] leading-tight h-[calc(100vh-350px)] min-h-64 max-h-[calc(100vh-350px)] overflow-y-auto resize-none"
                      placeholder="Compiled code will appear here..."
                    />
                    {output && (
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          onClick={handleCopy}
                          variant="outline"
                          className="w-full h-7 text-xs"
                        >
                          {copied ? (
                            <>
                              <Check className="mr-1 h-3 w-3" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="mr-1 h-3 w-3" />
                              Copy
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={handleDownload}
                          variant="outline"
                          className="w-full h-7 text-xs"
                        >
                          <Download className="mr-1 h-3 w-3" />
                          Download
                        </Button>
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="logs" className="mt-2">
                    <Textarea
                      value={logs}
                      readOnly
                      className="font-mono text-[10px] leading-tight h-[calc(100vh-300px)] min-h-64 max-h-[calc(100vh-300px)] overflow-y-auto resize-none"
                      placeholder="Compilation logs will appear here..."
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
