use super::ir::*;

pub fn dump_ir(module: &Module) -> String {
    let mut output = String::new();

    for func in &module.functions {
        output.push_str(&dump_function(func));
        output.push('\n');
    }

    output
}

fn dump_function(func: &IRFunction) -> String {
    let mut output = String::new();

    // Domain annotation (if not Classical)
    match func.domain {
        crate::frontend::ast::Domain::Gpu => output.push_str("@gpu\n"),
        crate::frontend::ast::Domain::Quantum => output.push_str("@quantum\n"),
        crate::frontend::ast::Domain::Classical => {},
    }

    // Function signature
    output.push_str(&format!("fn {}(", func.name));
    for (i, (name, ty)) in func.params.iter().enumerate() {
        if i > 0 {
            output.push_str(", ");
        }
        output.push_str(&format!("{}: {}", name, ty));
    }
    output.push_str(&format!(") -> {} {{\n", func.return_type));

    // Blocks
    for block in &func.blocks {
        output.push_str(&dump_block(block));
    }

    output.push_str("}\n");
    output
}

fn dump_block(block: &BasicBlock) -> String {
    let mut output = String::new();

    output.push_str(&format!("  {}:\n", block.label));

    for inst in &block.instructions {
        output.push_str(&format!("    {}\n", dump_instruction(inst)));
    }

    output.push_str(&format!("    {}\n", dump_terminator(&block.terminator)));

    output
}

fn dump_instruction(inst: &Instruction) -> String {
    match inst {
        Instruction::Assign { dest, value } => {
            format!("{} = {}", dest, dump_value(value))
        }
        Instruction::BinaryOp {
            dest,
            op,
            left,
            right,
        } => {
            format!(
                "{} = {} {} {}",
                dest,
                dump_binop(*op),
                dump_value(left),
                dump_value(right)
            )
        }
        Instruction::UnaryOp { dest, op, operand } => {
            format!("{} = {} {}", dest, dump_unop(*op), dump_value(operand))
        }
        Instruction::Load { dest, array, index } => {
            format!("{} = load {}[{}]", dest, array, dump_value(index))
        }
        Instruction::Store {
            array,
            index,
            value,
        } => {
            format!(
                "store {}[{}] = {}",
                array,
                dump_value(index),
                dump_value(value)
            )
        }
        Instruction::Call {
            dest,
            function,
            args,
        } => {
            let args_str = args
                .iter()
                .map(dump_value)
                .collect::<Vec<_>>()
                .join(", ");
            if let Some(d) = dest {
                format!("{} = call {}({})", d, function, args_str)
            } else {
                format!("call {}({})", function, args_str)
            }
        }
        Instruction::Phi { dest, incoming } => {
            let incoming_str = incoming
                .iter()
                .map(|(val, label)| format!("[{}, {}]", dump_value(val), label))
                .collect::<Vec<_>>()
                .join(", ");
            format!("{} = phi {}", dest, incoming_str)
        }
        Instruction::DomainConversion {
            dest,
            source,
            from_domain,
            to_domain,
            encoding,
        } => {
            format!(
                "{} = convert_{:?}_to_{:?}({}, {:?})",
                dest,
                from_domain,
                to_domain,
                dump_value(source),
                encoding
            )
        }
    }
}

fn dump_terminator(term: &Terminator) -> String {
    match term {
        Terminator::Return(val) => format!("return {}", dump_value(val)),
        Terminator::ReturnVoid => "return void".to_string(),
        Terminator::Branch {
            condition,
            true_label,
            false_label,
        } => format!(
            "br {}, {}, {}",
            dump_value(condition),
            true_label,
            false_label
        ),
        Terminator::Jump(label) => format!("jump {}", label),
    }
}

fn dump_value(val: &Value) -> String {
    match val {
        Value::Var(v) => format!("{}", v),
        Value::Int(n) => format!("{}", n),
        Value::Float(f) => format!("{}", f),
        Value::Bool(b) => format!("{}", b),
        Value::Array(elements) => {
            let elems_str = elements
                .iter()
                .map(dump_value)
                .collect::<Vec<_>>()
                .join(", ");
            format!("[{}]", elems_str)
        }
    }
}

fn dump_binop(op: BinOp) -> &'static str {
    match op {
        BinOp::Add => "add",
        BinOp::Sub => "sub",
        BinOp::Mul => "mul",
        BinOp::Div => "div",
        BinOp::Mod => "mod",
        BinOp::Eq => "eq",
        BinOp::Ne => "ne",
        BinOp::Lt => "lt",
        BinOp::Le => "le",
        BinOp::Gt => "gt",
        BinOp::Ge => "ge",
        BinOp::And => "and",
        BinOp::Or => "or",
    }
}

fn dump_unop(op: UnOp) -> &'static str {
    match op {
        UnOp::Neg => "neg",
        UnOp::Not => "not",
    }
}

