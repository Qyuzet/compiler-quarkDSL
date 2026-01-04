use crate::middle::ir::*;
use anyhow::Result;

pub fn codegen(module: &Module) -> Result<String> {
    let mut output = String::new();

    // Qiskit imports
    output.push_str("# Generated Qiskit code\n");
    output.push_str("from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister\n");
    output.push_str("from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2 as Sampler\n");
    output.push_str("from qiskit_aer import AerSimulator\n");
    output.push_str("import sys\n\n");

    // Configuration
    output.push_str("# ============================================================================\n");
    output.push_str("# Configuration\n");
    output.push_str("# ============================================================================\n\n");
    output.push_str("USE_QUANTUM_COMPUTER = False  # Set to True to use IBM Quantum hardware\n");
    output.push_str("IBM_API_KEY = \"krPjNWz0BsR_PSI0UVVG_VxIFSA27a5SaEgpLlI22-F-\"  # IBM Quantum API key\n\n");

    // Generate circuit from main function
    if let Some(main_func) = module.functions.iter().find(|f| f.name == "main") {
        output.push_str(&codegen_quantum_circuit(main_func)?);
    } else {
        // Generate from first function
        if let Some(func) = module.functions.first() {
            output.push_str(&codegen_quantum_circuit(func)?);
        }
    }

    // Runtime execution code
    output.push_str("\n# ============================================================================\n");
    output.push_str("# Execution\n");
    output.push_str("# ============================================================================\n\n");
    output.push_str("if __name__ == '__main__':\n");
    output.push_str("    if USE_QUANTUM_COMPUTER:\n");
    output.push_str("        # Use IBM Quantum hardware\n");
    output.push_str("        print(\"Connecting to IBM Quantum...\")\n");
    output.push_str("        service = QiskitRuntimeService(channel=\"ibm_quantum\", token=IBM_API_KEY)\n");
    output.push_str("        backend = service.least_busy(operational=True, simulator=False)\n");
    output.push_str("        print(f\"Using IBM Quantum backend: {backend.name}\")\n");
    output.push_str("        \n");
    output.push_str("        sampler = Sampler(backend)\n");
    output.push_str("        job = sampler.run([circuit], shots=1024)\n");
    output.push_str("        print(f\"Job ID: {job.job_id()}\")\n");
    output.push_str("        print(\"Waiting for results...\")\n");
    output.push_str("        result = job.result()\n");
    output.push_str("        \n");
    output.push_str("        # Extract counts from SamplerV2 result\n");
    output.push_str("        pub_result = result[0]\n");
    output.push_str("        counts = pub_result.data.meas.get_counts()\n");
    output.push_str("        print(f\"Counts: {counts}\")\n");
    output.push_str("    else:\n");
    output.push_str("        # Use local simulator\n");
    output.push_str("        print(\"Using local Qiskit Aer simulator\")\n");
    output.push_str("        backend = AerSimulator()\n");
    output.push_str("        result = backend.run(circuit, shots=1024).result()\n");
    output.push_str("        counts = result.get_counts()\n");
    output.push_str("        print(f\"Counts: {counts}\")\n");

    Ok(output)
}

fn codegen_quantum_circuit(func: &IRFunction) -> Result<String> {
    let mut output = String::new();

    // Estimate number of qubits needed
    let num_qubits = estimate_qubits(func);
    let num_classical = num_qubits; // Same number of classical bits for measurement

    output.push_str(&format!("# Function: {}\n", func.name));
    output.push_str(&format!("qr = QuantumRegister({}, 'q')\n", num_qubits));
    output.push_str(&format!("cr = ClassicalRegister({}, 'c')\n", num_classical));
    output.push_str("circuit = QuantumCircuit(qr, cr)\n\n");

    // Process instructions
    for block in &func.blocks {
        output.push_str(&format!("# Block: {}\n", block.label));

        for inst in &block.instructions {
            if let Some(quantum_op) = try_codegen_quantum_instruction(inst) {
                output.push_str(&format!("{}\n", quantum_op));
            } else {
                // Classical instruction - add as comment
                output.push_str(&format!("# Classical: {:?}\n", inst));
            }
        }
    }

    // Add measurements at the end
    output.push_str("\n# Measurements\n");
    output.push_str(&format!("circuit.measure(qr, cr)\n"));

    Ok(output)
}

fn try_codegen_quantum_instruction(inst: &Instruction) -> Option<String> {
    match inst {
        Instruction::DomainConversion { dest, source, encoding, .. } => {
            // Generate quantum encoding based on conversion type
            match encoding {
                crate::middle::ir::ConversionEncoding::AngleEncoding => {
                    // Angle encoding: encode classical values as rotation angles
                    Some(format!(
                        "# Angle encoding: {} = encode_angle({})",
                        dest.id, codegen_value(source)
                    ))
                }
                crate::middle::ir::ConversionEncoding::AmplitudeEncoding => {
                    // Amplitude encoding: encode as quantum state amplitudes
                    Some(format!(
                        "# Amplitude encoding: {} = encode_amplitude({})",
                        dest.id, codegen_value(source)
                    ))
                }
                crate::middle::ir::ConversionEncoding::MeasurementExtract => {
                    // Measurement extraction: extract classical values from quantum
                    Some(format!(
                        "# Measurement extract: {} = extract({})",
                        dest.id, codegen_value(source)
                    ))
                }
            }
        }
        Instruction::Call { function, args, .. } => {
            // Map function calls to quantum gates
            match function.as_str() {
                "h" | "hadamard" => {
                    if let Some(Value::Int(qubit)) = args.first() {
                        return Some(format!("circuit.h({})", qubit));
                    }
                }
                "x" | "pauli_x" => {
                    if let Some(Value::Int(qubit)) = args.first() {
                        return Some(format!("circuit.x({})", qubit));
                    }
                }
                "y" | "pauli_y" => {
                    if let Some(Value::Int(qubit)) = args.first() {
                        return Some(format!("circuit.y({})", qubit));
                    }
                }
                "z" | "pauli_z" => {
                    if let Some(Value::Int(qubit)) = args.first() {
                        return Some(format!("circuit.z({})", qubit));
                    }
                }
                "cx" | "cnot" => {
                    if args.len() >= 2 {
                        if let (Some(Value::Int(ctrl)), Some(Value::Int(target))) =
                            (args.get(0), args.get(1))
                        {
                            return Some(format!("circuit.cx({}, {})", ctrl, target));
                        }
                    }
                }
                "cz" => {
                    if args.len() >= 2 {
                        if let (Some(Value::Int(ctrl)), Some(Value::Int(target))) =
                            (args.get(0), args.get(1))
                        {
                            return Some(format!("circuit.cz({}, {})", ctrl, target));
                        }
                    }
                }
                "rx" => {
                    if args.len() >= 2 {
                        if let (Some(angle), Some(Value::Int(qubit))) = (args.get(0), args.get(1))
                        {
                            return Some(format!("circuit.rx({}, {})", codegen_value(angle), qubit));
                        }
                    }
                }
                "ry" => {
                    if args.len() >= 2 {
                        if let (Some(angle), Some(Value::Int(qubit))) = (args.get(0), args.get(1))
                        {
                            return Some(format!("circuit.ry({}, {})", codegen_value(angle), qubit));
                        }
                    }
                }
                "rz" => {
                    if args.len() >= 2 {
                        if let (Some(angle), Some(Value::Int(qubit))) = (args.get(0), args.get(1))
                        {
                            return Some(format!("circuit.rz({}, {})", codegen_value(angle), qubit));
                        }
                    }
                }
                _ => {}
            }
            None
        }
        _ => None,
    }
}

fn codegen_value(val: &Value) -> String {
    match val {
        Value::Int(n) => format!("{}", n),
        Value::Float(f) => format!("{}", f),
        Value::Bool(b) => format!("{}", b),
        Value::Var(v) => format!("v{}", v.id),
        Value::Array(_) => "[]".to_string(),
    }
}

fn estimate_qubits(func: &IRFunction) -> usize {
    // Simple heuristic: count unique qubit indices in quantum operations
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

    (max_qubit + 1).max(2) // At least 2 qubits
}

