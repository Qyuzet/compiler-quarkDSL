/// Python Orchestrator Backend - Generates hybrid execution code
///
/// This backend generates Python code that orchestrates:
/// 1. GPU execution (WGSL via WebGPU)
/// 2. Quantum execution (Qiskit)
/// 3. Data marshalling between domains

use super::super::middle::ir::*;
use anyhow::Result;

pub fn generate_orchestrator(module: &Module) -> Result<String> {
    let mut output = String::new();

    // Python imports
    output.push_str("#!/usr/bin/env python3\n");
    output.push_str("\"\"\"QuarkDSL Hybrid Orchestrator - Auto-generated\"\"\"\n\n");
    output.push_str("import numpy as np\n");
    output.push_str("try:\n");
    output.push_str("    from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister\n");
    output.push_str("    from qiskit_aer import AerSimulator\n");
    output.push_str("    from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2 as Sampler\n");
    output.push_str("    QISKIT_AVAILABLE = True\n");
    output.push_str("except ImportError:\n");
    output.push_str("    QISKIT_AVAILABLE = False\n");
    output.push_str("    print(\"Warning: Qiskit not installed. Quantum functions will not work.\")\n\n");

    // Configuration
    output.push_str("# ============================================================================\n");
    output.push_str("# Configuration\n");
    output.push_str("# ============================================================================\n");
    output.push_str("# Environment Variables:\n");
    output.push_str("#   DEBUG_MODE=true              - Enable debug output\n");
    output.push_str("#   USE_QUANTUM_COMPUTER=true    - Use IBM Quantum (requires IBM_API_KEY)\n");
    output.push_str("#   USE_CLOUD_SIMULATOR=true     - Use IBM Cloud Simulator (fast, default when USE_QUANTUM_COMPUTER=true)\n");
    output.push_str("#   USE_CLOUD_SIMULATOR=false    - Use real quantum hardware (slow, requires queue time)\n");
    output.push_str("#   IBM_API_KEY=your_key         - IBM Quantum API key\n");
    output.push_str("# ============================================================================\n\n");
    output.push_str("import os\n\n");
    output.push_str("DEBUG_MODE = os.getenv(\"DEBUG_MODE\", \"false\").lower() == \"true\"\n");
    output.push_str("USE_QUANTUM_COMPUTER = os.getenv(\"USE_QUANTUM_COMPUTER\", \"false\").lower() == \"true\"\n");
    output.push_str("IBM_API_KEY = os.getenv(\"IBM_API_KEY\", \"\")\n\n");
    output.push_str("if USE_QUANTUM_COMPUTER and not IBM_API_KEY:\n");
    output.push_str("    raise ValueError(\"IBM_API_KEY environment variable must be set when USE_QUANTUM_COMPUTER=true\")\n\n");

    // Generate helper functions
    output.push_str(&generate_helpers());

    // Generate function implementations
    for func in &module.functions {
        output.push_str(&generate_function(func)?);
        output.push_str("\n");
    }

    Ok(output)
}

fn generate_helpers() -> String {
    r#"# ============================================================================
# Helper Functions for Domain Conversions
# ============================================================================

def encode_angle(data):
    """Convert classical array to quantum state using angle encoding"""
    if isinstance(data, (int, float)):
        return float(data)
    return np.array(data, dtype=float)

def encode_amplitude(data):
    """Convert classical array to quantum state using amplitude encoding"""
    data = np.array(data, dtype=float)
    # Normalize to unit vector
    norm = np.linalg.norm(data)
    if norm > 0:
        data = data / norm
    return data

def extract_measurement(counts):
    """Extract classical value from quantum measurement counts"""
    # Get most common measurement result
    if not counts:
        return 0
    most_common = max(counts, key=counts.get)
    # Convert binary string to int
    return int(most_common, 2)

def run_quantum_circuit(circuit, shots=1024):
    """Execute quantum circuit and return counts"""
    if not QISKIT_AVAILABLE:
        print("Error: Qiskit is required for quantum circuit execution")
        print("Install with: pip install qiskit qiskit-aer qiskit-ibm-runtime")
        return {}

    if USE_QUANTUM_COMPUTER:
        # Use IBM Quantum hardware or cloud simulator
        from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
        import time

        # Track if we've already shown the fallback message
        global _aer_fallback_shown
        if '_aer_fallback_shown' not in globals():
            _aer_fallback_shown = False

        service = QiskitRuntimeService(channel="ibm_quantum_platform", token=IBM_API_KEY)

        # Check if we should use cloud simulator (faster) or real hardware (slower but real quantum)
        use_cloud_simulator = os.getenv("USE_CLOUD_SIMULATOR", "true").lower() == "true"

        if use_cloud_simulator:
            # Try to get IBM cloud simulator, fall back to local Aer if not available
            try:
                available_backends = service.backends(simulator=True)
                if available_backends:
                    backend = available_backends[0]
                    if not _aer_fallback_shown:
                        print(f"Using IBM Cloud Simulator: {backend.name}")
                        _aer_fallback_shown = True
                else:
                    raise Exception("No cloud simulator available")
            except Exception as e:
                if not _aer_fallback_shown:
                    print("Using local Aer simulator (IBM Cloud Simulator not available in free tier)")
                    if DEBUG_MODE:
                        print(f"  Debug: {e}")
                    _aer_fallback_shown = True
                simulator = AerSimulator()
                job = simulator.run(circuit, shots=shots)
                result = job.result()
                counts = result.get_counts()
                return counts
        else:
            backend = service.least_busy(operational=True, simulator=False)
            if not _aer_fallback_shown:
                print(f"\\n{'='*60}")
                print(f"Using real IBM Quantum hardware: {backend.name}")
                print("WARNING: Jobs may take minutes to hours due to queue times")
                print(f"{'='*60}\\n")
                _aer_fallback_shown = True

        # Transpile circuit for target hardware
        pm = generate_preset_pass_manager(backend=backend, optimization_level=3)
        transpiled_circuit = pm.run(circuit)

        if DEBUG_MODE:
            print(f"Original circuit depth: {circuit.depth()}")
            print(f"Transpiled circuit depth: {transpiled_circuit.depth()}")

        sampler = Sampler(backend)
        job = sampler.run([transpiled_circuit], shots=shots)

        print(f"\\n{'='*60}")
        print(f"Job submitted to IBM Quantum")
        print(f"Job ID: {job.job_id()}")
        print(f"Backend: {backend.name}")
        print(f"{'='*60}\\n")

        # Wait for result with animated status updates
        animation_chars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
        animation_idx = 0
        wait_time = 0

        while job.status() not in ['DONE', 'ERROR', 'CANCELLED']:
            status = job.status()
            elapsed_min = wait_time // 60
            elapsed_sec = wait_time % 60

            if not use_cloud_simulator:
                print(f"\\r{animation_chars[animation_idx]} Waiting for quantum job... "
                      f"Status: {status} | Elapsed: {elapsed_min}m {elapsed_sec}s", end='', flush=True)
            else:
                print(f"\\r{animation_chars[animation_idx]} Processing... Status: {status}", end='', flush=True)

            animation_idx = (animation_idx + 1) % len(animation_chars)
            time.sleep(1)
            wait_time += 1

        print(f"\\r{'✓'} Job completed! Status: {job.status()}" + " " * 50)
        print()

        if job.status() == 'DONE':
            result = job.result()

            # Extract counts from SamplerV2 result
            pub_result = result[0]
            data_bin = pub_result.data

            # Get the first measurement register (DataBin contains all classical registers)
            register_names = list(data_bin.__dict__.keys())
            if register_names:
                first_register = getattr(data_bin, register_names[0])
                counts_dict = first_register.get_counts()
            else:
                counts_dict = {}

            return counts_dict
        else:
            print(f"Job failed with status: {job.status()}")
            return {}
    else:
        # Use local simulator
        if DEBUG_MODE:
            print("Using local Qiskit Aer simulator")
        simulator = AerSimulator()
        job = simulator.run(circuit, shots=shots)
        result = job.result()
        counts = result.get_counts()
        return counts

# ============================================================================
# GPU Simulation (Simplified - replace with actual WebGPU)
# ============================================================================

def simulate_gpu_function(func_name, *args):
    """Simulate GPU execution (placeholder for WebGPU)"""
    # In real implementation, this would:
    # 1. Compile WGSL shader
    # 2. Upload data to GPU
    # 3. Execute compute shader
    # 4. Download results
    # For now, just execute on CPU
    return None  # Will be replaced by actual function calls


"#.to_string()
}

fn generate_function(func: &IRFunction) -> Result<String> {
    let mut output = String::new();

    // Function signature
    output.push_str(&format!("def {}(", func.name));
    for (i, (name, _ty)) in func.params.iter().enumerate() {
        if i > 0 {
            output.push_str(", ");
        }
        output.push_str(name);
    }
    output.push_str("):\n");

    // Docstring with domain info
    output.push_str(&format!("    \"\"\"Domain: {:?}\"\"\"\n", func.domain));

    // Function body based on domain
    match func.domain {
        crate::frontend::ast::Domain::Gpu => {
            output.push_str(&generate_gpu_function_body(func)?);
        }
        crate::frontend::ast::Domain::Quantum => {
            output.push_str(&generate_quantum_function_body(func)?);
        }
        crate::frontend::ast::Domain::Classical => {
            output.push_str(&generate_classical_function_body(func)?);
        }
    }

    Ok(output)
}

fn generate_gpu_function_body(func: &IRFunction) -> Result<String> {
    let mut output = String::new();
    output.push_str("    # GPU function - NumPy simulation\n");

    // Build variable name mapping (parameters use their names, others use v{})
    let mut var_names = std::collections::HashMap::new();
    for (i, (param_name, _)) in func.params.iter().enumerate() {
        var_names.insert(i, param_name.clone());
    }

    // Build inline map for single-use variables
    let inline_map = build_inline_map(func);

    // Generate instructions (skip inlined ones)
    for block in &func.blocks {
        for inst in &block.instructions {
            // Skip instructions that define variables to be inlined
            if let Some(dest) = get_dest_var(inst) {
                if inline_map.contains_key(&dest.id) {
                    continue;
                }
            }
            output.push_str(&generate_python_instruction_with_inline(inst, &var_names, &inline_map)?);
        }
        output.push_str(&generate_python_terminator_with_inline(&block.terminator, &var_names, &inline_map)?);
    }

    Ok(output)
}

fn generate_quantum_function_body(func: &IRFunction) -> Result<String> {
    let mut output = String::new();

    // Estimate qubits needed
    let num_qubits = estimate_qubits(func);

    output.push_str(&format!("    # Quantum function - {} qubits\n", num_qubits));
    output.push_str("    if not QISKIT_AVAILABLE:\n");
    output.push_str("        print(\"Error: Qiskit is required for quantum functions\")\n");
    output.push_str("        print(\"Install with: pip install qiskit qiskit-aer qiskit-ibm-runtime\")\n");
    output.push_str("        return 0\n\n");
    output.push_str(&format!("    qr = QuantumRegister({}, 'q')\n", num_qubits));
    output.push_str(&format!("    cr = ClassicalRegister({}, 'c')\n", num_qubits));
    output.push_str("    circuit = QuantumCircuit(qr, cr)\n\n");

    // Build variable name mapping
    let mut var_names = std::collections::HashMap::new();
    for (i, (param_name, _)) in func.params.iter().enumerate() {
        var_names.insert(i, param_name.clone());
    }

    // Build inline map for single-use variables
    let inline_map = build_inline_map(func);

    // Track variables that come from measure() calls (including transitive assigns)
    let mut measure_vars = std::collections::HashSet::new();
    for block in &func.blocks {
        for inst in &block.instructions {
            if let Instruction::Call { function, dest, .. } = inst {
                if function == "measure" {
                    if let Some(d) = dest {
                        measure_vars.insert(d.id);
                    }
                }
            }
        }
    }

    // Also track variables assigned from measure vars
    let mut changed = true;
    while changed {
        changed = false;
        for block in &func.blocks {
            for inst in &block.instructions {
                if let Instruction::Assign { dest, value } = inst {
                    if let Value::Var(var) = value {
                        if measure_vars.contains(&var.id) && !measure_vars.contains(&dest.id) {
                            measure_vars.insert(dest.id);
                            changed = true;
                        }
                    }
                }
            }
        }
    }

    // Generate quantum operations (skip inlined ones and measure-related instructions)
    for block in &func.blocks {
        for inst in &block.instructions {
            // Skip measure() calls - we do global measurement at the end
            if let Instruction::Call { function, .. } = inst {
                if function == "measure" {
                    continue;
                }
            }

            // Skip all Assign instructions in quantum functions - they're not needed for circuit building
            if matches!(inst, Instruction::Assign { .. }) {
                continue;
            }

            // Skip instructions that define variables to be inlined
            if let Some(dest) = get_dest_var(inst) {
                if inline_map.contains_key(&dest.id) {
                    continue;
                }
            }
            output.push_str(&generate_quantum_instruction_with_inline(inst, &var_names, &inline_map)?);
        }
    }

    // Add measurements
    output.push_str("\n    # Measurements\n");
    output.push_str("    circuit.measure(qr, cr)\n");
    output.push_str("    counts = run_quantum_circuit(circuit)\n");
    output.push_str("    result = extract_measurement(counts)\n");
    output.push_str("    return result\n");

    Ok(output)
}

fn generate_classical_function_body(func: &IRFunction) -> Result<String> {
    let mut output = String::new();
    output.push_str("    # Classical orchestration function\n");

    // Build variable name mapping
    let mut var_names = std::collections::HashMap::new();
    for (i, (param_name, _)) in func.params.iter().enumerate() {
        var_names.insert(i, param_name.clone());
    }

    // Build inline map for single-use variables
    let inline_map = build_inline_map(func);

    // Generate instructions (skip inlined ones)
    for block in &func.blocks {
        for inst in &block.instructions {
            // Skip instructions that define variables to be inlined
            if let Some(dest) = get_dest_var(inst) {
                if inline_map.contains_key(&dest.id) {
                    continue;
                }
            }
            output.push_str(&generate_python_instruction_with_inline(inst, &var_names, &inline_map)?);
        }
        output.push_str(&generate_python_terminator_with_inline(&block.terminator, &var_names, &inline_map)?);
    }

    Ok(output)
}

fn generate_python_instruction(inst: &Instruction) -> Result<String> {
    generate_python_instruction_with_names(inst, &std::collections::HashMap::new())
}

fn generate_python_instruction_with_inline(inst: &Instruction, var_names: &std::collections::HashMap<usize, String>, inline_map: &std::collections::HashMap<usize, String>) -> Result<String> {
    let code = match inst {
        Instruction::Assign { dest, value } => {
            format!("    {} = {}\n", var_name(dest.id, var_names), python_value_with_inline(value, var_names, inline_map))
        }
        Instruction::BinaryOp { dest, op, left, right } => {
            let op_str = match op {
                BinOp::Add => "+",
                BinOp::Sub => "-",
                BinOp::Mul => "*",
                BinOp::Div => "/",
                BinOp::Mod => "%",
                BinOp::Eq => "==",
                BinOp::Ne => "!=",
                BinOp::Lt => "<",
                BinOp::Le => "<=",
                BinOp::Gt => ">",
                BinOp::Ge => ">=",
                BinOp::And => "and",
                BinOp::Or => "or",
            };
            format!("    {} = {} {} {}\n",
                var_name(dest.id, var_names),
                python_value_with_inline(left, var_names, inline_map),
                op_str,
                python_value_with_inline(right, var_names, inline_map))
        }
        Instruction::UnaryOp { dest, op, operand } => {
            let op_str = match op {
                UnOp::Neg => "-",
                UnOp::Not => "not ",
            };
            format!("    {} = {}{}\n", var_name(dest.id, var_names), op_str, python_value_with_inline(operand, var_names, inline_map))
        }
        Instruction::Load { dest, array, index } => {
            format!("    {} = {}[{}]\n",
                var_name(dest.id, var_names),
                var_name(array.id, var_names),
                python_value_with_inline(index, var_names, inline_map))
        }
        Instruction::Store { array, index, value } => {
            format!("    {}[{}] = {}\n",
                var_name(array.id, var_names),
                python_value_with_inline(index, var_names, inline_map),
                python_value_with_inline(value, var_names, inline_map))
        }
        Instruction::Call { dest, function, args } => {
            let args_str = args.iter()
                .map(|arg| python_value_with_inline(arg, var_names, inline_map))
                .collect::<Vec<_>>()
                .join(", ");
            let mut result = String::new();

            // Handle built-in print functions
            if function == "print" || function == "print_float" || function == "print_array" {
                result.push_str(&format!("    print({})\n", args_str));
            } else if let Some(d) = dest {
                result.push_str(&format!("    {} = {}({})\n", var_name(d.id, var_names), function, args_str));
                result.push_str(&format!("    if DEBUG_MODE:\n        print(f\"  {}({}) = {{{}}}\")\n",
                    function, args_str, var_name(d.id, var_names)));
            } else {
                result.push_str(&format!("    {}({})\n", function, args_str));
                result.push_str(&format!("    if DEBUG_MODE:\n        print(f\"  {}({})\")\n", function, args_str));
            }
            result
        }
        Instruction::DomainConversion { dest, source, from_domain, to_domain, encoding } => {
            format!("    {} = encode_angle({})\n",
                var_name(dest.id, var_names),
                python_value_with_inline(source, var_names, inline_map))
        }
        _ => String::new(),
    };
    Ok(code)
}

fn generate_python_instruction_with_names(inst: &Instruction, var_names: &std::collections::HashMap<usize, String>) -> Result<String> {
    let code = match inst {
        Instruction::Assign { dest, value } => {
            format!("    {} = {}\n", var_name(dest.id, var_names), python_value_with_names(value, var_names))
        }
        Instruction::BinaryOp { dest, op, left, right } => {
            let op_str = match op {
                BinOp::Add => "+",
                BinOp::Sub => "-",
                BinOp::Mul => "*",
                BinOp::Div => "/",
                BinOp::Mod => "%",
                BinOp::Eq => "==",
                BinOp::Ne => "!=",
                BinOp::Lt => "<",
                BinOp::Le => "<=",
                BinOp::Gt => ">",
                BinOp::Ge => ">=",
                BinOp::And => "and",
                BinOp::Or => "or",
            };
            format!("    {} = {} {} {}\n",
                var_name(dest.id, var_names),
                python_value_with_names(left, var_names),
                op_str,
                python_value_with_names(right, var_names))
        }
        Instruction::UnaryOp { dest, op, operand } => {
            let op_str = match op {
                UnOp::Neg => "-",
                UnOp::Not => "not ",
            };
            format!("    {} = {}{}\n", var_name(dest.id, var_names), op_str, python_value_with_names(operand, var_names))
        }
        Instruction::Load { dest, array, index } => {
            format!("    {} = {}[{}]\n",
                var_name(dest.id, var_names),
                var_name(array.id, var_names),
                python_value_with_names(index, var_names))
        }
        Instruction::Store { array, index, value } => {
            format!("    {}[{}] = {}\n",
                var_name(array.id, var_names),
                python_value_with_names(index, var_names),
                python_value_with_names(value, var_names))
        }
        Instruction::Call { dest, function, args } => {
            let args_str = args.iter()
                .map(|a| python_value_with_names(a, var_names))
                .collect::<Vec<_>>()
                .join(", ");
            if let Some(d) = dest {
                format!("    {} = {}({})\n", var_name(d.id, var_names), function, args_str)
            } else {
                format!("    {}({})\n", function, args_str)
            }
        }
        Instruction::DomainConversion { dest, source, from_domain, to_domain, encoding } => {
            let conv_fn = match (from_domain, to_domain, encoding) {
                (_, _, ConversionEncoding::AngleEncoding) => "encode_angle",
                (_, _, ConversionEncoding::AmplitudeEncoding) => "encode_amplitude",
                (_, _, ConversionEncoding::MeasurementExtract) => "extract_measurement",
            };
            format!("    {} = {}({})\n", var_name(dest.id, var_names), conv_fn, python_value_with_names(source, var_names))
        }
        Instruction::Phi { .. } => {
            "    # phi node\n".to_string()
        }
    };
    Ok(code)
}

fn generate_python_terminator(term: &Terminator) -> Result<String> {
    generate_python_terminator_with_names(term, &std::collections::HashMap::new())
}

fn generate_python_terminator_with_names(term: &Terminator, var_names: &std::collections::HashMap<usize, String>) -> Result<String> {
    let code = match term {
        Terminator::Return(val) => {
            format!("    return {}\n", python_value_with_names(val, var_names))
        }
        Terminator::ReturnVoid => {
            "    return None\n".to_string()
        }
        Terminator::Branch { condition, true_label, false_label } => {
            format!("    if {}:\n        goto {}\n    else:\n        goto {}\n",
                python_value_with_names(condition, var_names), true_label, false_label)
        }
        Terminator::Jump(label) => {
            format!("    goto {}\n", label)
        }
    };
    Ok(code)
}

fn generate_python_terminator_with_inline(term: &Terminator, var_names: &std::collections::HashMap<usize, String>, inline_map: &std::collections::HashMap<usize, String>) -> Result<String> {
    let code = match term {
        Terminator::Return(val) => {
            format!("    return {}\n", python_value_with_inline(val, var_names, inline_map))
        }
        Terminator::ReturnVoid => {
            "    return None\n".to_string()
        }
        Terminator::Branch { condition, true_label, false_label } => {
            format!("    if {}:\n        goto {}\n    else:\n        goto {}\n",
                python_value_with_inline(condition, var_names, inline_map), true_label, false_label)
        }
        Terminator::Jump(label) => {
            format!("    goto {}\n", label)
        }
    };
    Ok(code)
}

fn var_name(id: usize, var_names: &std::collections::HashMap<usize, String>) -> String {
    var_names.get(&id).cloned().unwrap_or_else(|| format!("v{}", id))
}

fn python_value(val: &Value) -> String {
    python_value_with_names(val, &std::collections::HashMap::new())
}

fn python_value_with_names(val: &Value, var_names: &std::collections::HashMap<usize, String>) -> String {
    match val {
        Value::Int(n) => format!("{}", n),
        Value::Float(f) => format!("{}", f),
        Value::Bool(b) => if *b { "True" } else { "False" }.to_string(),
        Value::Var(v) => var_name(v.id, var_names),
        Value::Array(elements) => {
            let elems = elements.iter()
                .map(|e| python_value_with_names(e, var_names))
                .collect::<Vec<_>>()
                .join(", ");
            format!("[{}]", elems)
        }
    }
}

fn python_value_with_inline(val: &Value, var_names: &std::collections::HashMap<usize, String>, inline_map: &std::collections::HashMap<usize, String>) -> String {
    match val {
        Value::Int(n) => format!("{}", n),
        Value::Float(f) => format!("{}", f),
        Value::Bool(b) => if *b { "True" } else { "False" }.to_string(),
        Value::Var(v) => {
            // Check if this variable should be inlined
            if let Some(inlined_expr) = inline_map.get(&v.id) {
                inlined_expr.clone()
            } else {
                var_name(v.id, var_names)
            }
        }
        Value::Array(elements) => {
            let elems = elements.iter()
                .map(|e| python_value_with_inline(e, var_names, inline_map))
                .collect::<Vec<_>>()
                .join(", ");
            format!("[{}]", elems)
        }
    }
}

fn generate_quantum_instruction(inst: &Instruction) -> Result<String> {
    generate_quantum_instruction_with_names(inst, &std::collections::HashMap::new())
}

fn generate_quantum_instruction_with_inline(inst: &Instruction, var_names: &std::collections::HashMap<usize, String>, inline_map: &std::collections::HashMap<usize, String>) -> Result<String> {
    let code = match inst {
        Instruction::Load { dest, array, index } => {
            format!("    {} = {}[{}]\n",
                var_name(dest.id, var_names),
                var_name(array.id, var_names),
                python_value_with_inline(index, var_names, inline_map))
        }
        Instruction::Assign { dest, value } => {
            format!("    {} = {}\n", var_name(dest.id, var_names), python_value_with_inline(value, var_names, inline_map))
        }
        Instruction::Call { function, args, dest } => {
            // Map quantum gate calls to Qiskit
            match function.as_str() {
                "h" | "hadamard" => {
                    if let Some(Value::Int(qubit)) = args.first() {
                        format!("    circuit.h(qr[{}])\n", qubit)
                    } else {
                        "    # h gate (invalid args)\n".to_string()
                    }
                }
                "x" | "pauli_x" => {
                    if let Some(Value::Int(qubit)) = args.first() {
                        format!("    circuit.x(qr[{}])\n", qubit)
                    } else {
                        "    # x gate (invalid args)\n".to_string()
                    }
                }
                "ry" => {
                    if args.len() >= 2 {
                        if let (Some(qubit_val), Some(angle)) = (args.get(0), args.get(1)) {
                            if let Value::Int(qubit) = qubit_val {
                                format!("    circuit.ry({}, qr[{}])\n", python_value_with_inline(angle, var_names, inline_map), qubit)
                            } else {
                                "    # ry gate (invalid qubit)\n".to_string()
                            }
                        } else {
                            "    # ry gate (invalid args)\n".to_string()
                        }
                    } else {
                        "    # ry gate (missing args)\n".to_string()
                    }
                }
                "cx" | "cnot" => {
                    if args.len() >= 2 {
                        if let (Some(Value::Int(control)), Some(Value::Int(target))) = (args.get(0), args.get(1)) {
                            format!("    circuit.cx(qr[{}], qr[{}])\n", control, target)
                        } else {
                            "    # cx gate (invalid args)\n".to_string()
                        }
                    } else {
                        "    # cx gate (missing args)\n".to_string()
                    }
                }
                _ => String::new(),
            }
        }
        _ => String::new(),
    };
    Ok(code)
}

fn generate_quantum_instruction_with_names(inst: &Instruction, var_names: &std::collections::HashMap<usize, String>) -> Result<String> {
    let code = match inst {
        Instruction::Call { function, args, dest } => {
            // Map quantum gate calls to Qiskit
            match function.as_str() {
                "h" | "hadamard" => {
                    if let Some(Value::Int(qubit)) = args.first() {
                        format!("    circuit.h(qr[{}])\n", qubit)
                    } else {
                        "    # h gate (invalid args)\n".to_string()
                    }
                }
                "x" | "pauli_x" => {
                    if let Some(Value::Int(qubit)) = args.first() {
                        format!("    circuit.x(qr[{}])\n", qubit)
                    } else {
                        "    # x gate (invalid args)\n".to_string()
                    }
                }
                "y" | "pauli_y" => {
                    if let Some(Value::Int(qubit)) = args.first() {
                        format!("    circuit.y(qr[{}])\n", qubit)
                    } else {
                        "    # y gate (invalid args)\n".to_string()
                    }
                }
                "z" | "pauli_z" => {
                    if let Some(Value::Int(qubit)) = args.first() {
                        format!("    circuit.z(qr[{}])\n", qubit)
                    } else {
                        "    # z gate (invalid args)\n".to_string()
                    }
                }
                "rx" => {
                    if args.len() >= 2 {
                        if let (Some(qubit_val), Some(angle)) = (args.get(0), args.get(1)) {
                            if let Value::Int(qubit) = qubit_val {
                                format!("    circuit.rx({}, qr[{}])\n", python_value_with_names(angle, var_names), qubit)
                            } else {
                                "    # rx gate (invalid qubit)\n".to_string()
                            }
                        } else {
                            "    # rx gate (invalid args)\n".to_string()
                        }
                    } else {
                        "    # rx gate (missing args)\n".to_string()
                    }
                }
                "ry" => {
                    if args.len() >= 2 {
                        if let (Some(qubit_val), Some(angle)) = (args.get(0), args.get(1)) {
                            if let Value::Int(qubit) = qubit_val {
                                format!("    circuit.ry({}, qr[{}])\n", python_value_with_names(angle, var_names), qubit)
                            } else {
                                "    # ry gate (invalid qubit)\n".to_string()
                            }
                        } else {
                            "    # ry gate (invalid args)\n".to_string()
                        }
                    } else {
                        "    # ry gate (missing args)\n".to_string()
                    }
                }
                "rz" => {
                    if args.len() >= 2 {
                        if let (Some(qubit_val), Some(angle)) = (args.get(0), args.get(1)) {
                            if let Value::Int(qubit) = qubit_val {
                                format!("    circuit.rz({}, qr[{}])\n", python_value_with_names(angle, var_names), qubit)
                            } else {
                                "    # rz gate (invalid qubit)\n".to_string()
                            }
                        } else {
                            "    # rz gate (invalid args)\n".to_string()
                        }
                    } else {
                        "    # rz gate (missing args)\n".to_string()
                    }
                }
                "cx" | "cnot" => {
                    if args.len() >= 2 {
                        if let (Some(Value::Int(ctrl)), Some(Value::Int(target))) = (args.get(0), args.get(1)) {
                            format!("    circuit.cx(qr[{}], qr[{}])\n", ctrl, target)
                        } else {
                            "    # cx gate (invalid args)\n".to_string()
                        }
                    } else {
                        "    # cx gate (missing args)\n".to_string()
                    }
                }
                "cz" => {
                    if args.len() >= 2 {
                        if let (Some(Value::Int(ctrl)), Some(Value::Int(target))) = (args.get(0), args.get(1)) {
                            format!("    circuit.cz(qr[{}], qr[{}])\n", ctrl, target)
                        } else {
                            "    # cz gate (invalid args)\n".to_string()
                        }
                    } else {
                        "    # cz gate (missing args)\n".to_string()
                    }
                }
                "measure" => {
                    // Store result in variable if dest exists
                    if let Some(d) = dest {
                        format!("    {} = 0  # measure placeholder\n", var_name(d.id, var_names))
                    } else {
                        "    # measure\n".to_string()
                    }
                }
                _ => {
                    format!("    # unknown quantum op: {}\n", function)
                }
            }
        }
        Instruction::Load { dest, array, index } => {
            format!("    {} = {}[{}]\n",
                var_name(dest.id, var_names),
                var_name(array.id, var_names),
                python_value_with_names(index, var_names))
        }
        Instruction::Assign { dest, value } => {
            format!("    {} = {}\n", var_name(dest.id, var_names), python_value_with_names(value, var_names))
        }
        _ => {
            format!("    # {:?}\n", inst)
        }
    };
    Ok(code)
}

fn get_dest_var(inst: &Instruction) -> Option<SSAVar> {
    match inst {
        Instruction::Assign { dest, .. } => Some(*dest),
        Instruction::BinaryOp { dest, .. } => Some(*dest),
        Instruction::UnaryOp { dest, .. } => Some(*dest),
        Instruction::Load { dest, .. } => Some(*dest),
        Instruction::Call { dest, .. } => *dest,
        Instruction::Phi { dest, .. } => Some(*dest),
        Instruction::DomainConversion { dest, .. } => Some(*dest),
        _ => None,
    }
}

fn collect_used_var_ids(inst: &Instruction, used: &mut std::collections::HashSet<usize>) {
    match inst {
        Instruction::Assign { value, .. } => collect_value_vars(value, used),
        Instruction::BinaryOp { left, right, .. } => {
            collect_value_vars(left, used);
            collect_value_vars(right, used);
        }
        Instruction::UnaryOp { operand, .. } => collect_value_vars(operand, used),
        Instruction::Load { array, index, .. } => {
            used.insert(array.id);
            collect_value_vars(index, used);
        }
        Instruction::Store { array, index, value } => {
            used.insert(array.id);
            collect_value_vars(index, used);
            collect_value_vars(value, used);
        }
        Instruction::Call { args, .. } => {
            for arg in args {
                collect_value_vars(arg, used);
            }
        }
        Instruction::DomainConversion { source, .. } => collect_value_vars(source, used),
        _ => {}
    }
}

fn collect_value_vars(value: &Value, used: &mut std::collections::HashSet<usize>) {
    match value {
        Value::Var(v) => { used.insert(v.id); }
        Value::Array(elements) => {
            for elem in elements {
                collect_value_vars(elem, used);
            }
        }
        _ => {}
    }
}

fn estimate_qubits(func: &IRFunction) -> usize {
    // Simple heuristic: count unique qubit indices
    let mut max_qubit = 0;
    for block in &func.blocks {
        for inst in &block.instructions {
            if let Instruction::Call { args, .. } = inst {
                for arg in args {
                    if let Value::Int(n) = arg {
                        if *n >= 0 {
                            max_qubit = max_qubit.max(*n as usize);
                        }
                    }
                }
            }
        }
    }
    (max_qubit + 1).max(2)
}

// Build inline map: variables that are used only once and can be inlined
fn build_inline_map(func: &IRFunction) -> std::collections::HashMap<usize, String> {
    use std::collections::HashMap;

    // Count uses of each variable
    let mut use_count: HashMap<usize, usize> = HashMap::new();
    // Track variables used as arrays in Store/Load (can't be inlined)
    let mut no_inline_vars: std::collections::HashSet<usize> = std::collections::HashSet::new();

    for block in &func.blocks {
        for inst in &block.instructions {
            // Count uses in operands
            match inst {
                Instruction::Assign { value, .. } => count_value_uses(value, &mut use_count),
                Instruction::BinaryOp { left, right, .. } => {
                    count_value_uses(left, &mut use_count);
                    count_value_uses(right, &mut use_count);
                }
                Instruction::UnaryOp { operand, .. } => count_value_uses(operand, &mut use_count),
                Instruction::Load { array, index, .. } => {
                    // Arrays in Load can't be inlined
                    no_inline_vars.insert(array.id);
                    count_value_uses(index, &mut use_count);
                }
                Instruction::Store { array, index, value, .. } => {
                    // Arrays in Store can't be inlined
                    no_inline_vars.insert(array.id);
                    count_value_uses(index, &mut use_count);
                    count_value_uses(value, &mut use_count);
                }
                Instruction::Call { args, .. } => {
                    for arg in args {
                        count_value_uses(arg, &mut use_count);
                    }
                }
                Instruction::DomainConversion { source, .. } => count_value_uses(source, &mut use_count),
                _ => {}
            }
        }
        // Count uses in terminator
        match &block.terminator {
            Terminator::Return(val) => count_value_uses(val, &mut use_count),
            Terminator::Branch { condition, .. } => count_value_uses(condition, &mut use_count),
            _ => {}
        }
    }

    // Build inline map for single-use variables
    // Do this in multiple passes to handle dependencies
    let mut inline_map = HashMap::new();

    // Pass 1: Inline Loads and simple Assigns
    for block in &func.blocks {
        for inst in &block.instructions {
            if let Some(dest) = get_dest_var(inst) {
                // Skip parameters
                if dest.id < func.params.len() {
                    continue;
                }

                // Skip variables that can't be inlined (used as arrays)
                if no_inline_vars.contains(&dest.id) {
                    continue;
                }

                // Only inline if used exactly once
                if use_count.get(&dest.id).copied().unwrap_or(0) == 1 {
                    match inst {
                        Instruction::Load { dest: _, array, index } => {
                            // Inline Load as array[index]
                            let array_name = var_name_from_id(array.id, func);
                            let index_str = value_to_inline_string(index, func, &inline_map);
                            inline_map.insert(dest.id, format!("{}[{}]", array_name, index_str));
                        }
                        Instruction::Assign { value, .. } => {
                            // Inline simple assigns
                            let value_str = value_to_inline_string(value, func, &inline_map);
                            inline_map.insert(dest.id, value_str);
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    // Pass 2: Inline BinaryOps using the inline_map from Pass 1
    for block in &func.blocks {
        for inst in &block.instructions {
            if let Some(dest) = get_dest_var(inst) {
                // Skip parameters
                if dest.id < func.params.len() {
                    continue;
                }

                // Skip variables that can't be inlined (used as arrays)
                if no_inline_vars.contains(&dest.id) {
                    continue;
                }

                // Only inline if used exactly once and not already inlined
                if use_count.get(&dest.id).copied().unwrap_or(0) == 1 && !inline_map.contains_key(&dest.id) {
                    match inst {
                        Instruction::BinaryOp { op, left, right, .. } => {
                            // Inline BinaryOp as (left op right)
                            let left_str = value_to_inline_string(left, func, &inline_map);
                            let right_str = value_to_inline_string(right, func, &inline_map);
                            let op_str = match op {
                                BinOp::Add => "+",
                                BinOp::Sub => "-",
                                BinOp::Mul => "*",
                                BinOp::Div => "/",
                                BinOp::Mod => "%",
                                BinOp::Eq => "==",
                                BinOp::Ne => "!=",
                                BinOp::Lt => "<",
                                BinOp::Le => "<=",
                                BinOp::Gt => ">",
                                BinOp::Ge => ">=",
                                BinOp::And => "and",
                                BinOp::Or => "or",
                            };
                            inline_map.insert(dest.id, format!("{} {} {}", left_str, op_str, right_str));
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    inline_map
}

fn count_value_uses(value: &Value, use_count: &mut std::collections::HashMap<usize, usize>) {
    if let Value::Var(v) = value {
        *use_count.entry(v.id).or_insert(0) += 1;
    }
}

fn var_name_from_id(var_id: usize, func: &IRFunction) -> String {
    // Check if it's a parameter
    if var_id < func.params.len() {
        func.params[var_id].0.clone()
    } else {
        format!("v{}", var_id)
    }
}

fn value_to_inline_string(value: &Value, func: &IRFunction, inline_map: &std::collections::HashMap<usize, String>) -> String {
    match value {
        Value::Var(v) => {
            if let Some(inlined) = inline_map.get(&v.id) {
                inlined.clone()
            } else {
                var_name_from_id(v.id, func)
            }
        }
        Value::Int(n) => n.to_string(),
        Value::Float(f) => f.to_string(),
        Value::Bool(b) => b.to_string(),
        Value::Array(elements) => {
            let elem_strs: Vec<String> = elements.iter()
                .map(|e| value_to_inline_string(e, func, inline_map))
                .collect();
            format!("[{}]", elem_strs.join(", "))
        }
    }
}

