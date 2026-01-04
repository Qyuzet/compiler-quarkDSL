use crate::middle::ir::*;
use anyhow::Result;

pub fn codegen(module: &Module) -> Result<String> {
    let mut output = String::new();

    output.push_str("// Generated WGSL code\n\n");

    for func in &module.functions {
        output.push_str(&codegen_function(func)?);
        output.push('\n');
    }

    Ok(output)
}

fn codegen_function(func: &IRFunction) -> Result<String> {
    let mut output = String::new();

    // Function signature
    output.push_str(&format!("fn {}(", func.name));
    for (i, (name, ty)) in func.params.iter().enumerate() {
        if i > 0 {
            output.push_str(", ");
        }
        output.push_str(&format!("{}: {}", name, wgsl_type(ty)));
    }
    output.push_str(&format!(") -> {} {{\n", wgsl_type(&func.return_type)));

    // Variable declarations (collect all SSA vars)
    let mut declared_vars = std::collections::HashSet::new();
    for block in &func.blocks {
        for inst in &block.instructions {
            if let Some(dest) = get_dest_var(inst) {
                if declared_vars.insert(dest.id) {
                    output.push_str(&format!("  var {}: {};\n", var_name(dest), infer_var_type(inst)));
                }
            }
        }
    }

    output.push('\n');

    // Blocks (WGSL doesn't have explicit blocks, so we flatten)
    for block in &func.blocks {
        if block.label != "entry" {
            output.push_str(&format!("  // {}\n", block.label));
        }

        for inst in &block.instructions {
            output.push_str(&format!("  {}\n", codegen_instruction(inst)?));
        }

        output.push_str(&format!("  {}\n", codegen_terminator(&block.terminator)?));
    }

    output.push_str("}\n");
    Ok(output)
}

fn codegen_instruction(inst: &Instruction) -> Result<String> {
    match inst {
        Instruction::Assign { dest, value } => {
            Ok(format!("{} = {};", var_name(*dest), codegen_value(value)))
        }
        Instruction::BinaryOp {
            dest,
            op,
            left,
            right,
        } => Ok(format!(
            "{} = {} {} {};",
            var_name(*dest),
            codegen_value(left),
            wgsl_binop(*op),
            codegen_value(right)
        )),
        Instruction::UnaryOp { dest, op, operand } => Ok(format!(
            "{} = {}({});",
            var_name(*dest),
            wgsl_unop(*op),
            codegen_value(operand)
        )),
        Instruction::Load { dest, array, index } => Ok(format!(
            "{} = {}[{}];",
            var_name(*dest),
            var_name(*array),
            codegen_value(index)
        )),
        Instruction::Store {
            array,
            index,
            value,
        } => Ok(format!(
            "{}[{}] = {};",
            var_name(*array),
            codegen_value(index),
            codegen_value(value)
        )),
        Instruction::Call {
            dest,
            function,
            args,
        } => {
            let args_str = args
                .iter()
                .map(codegen_value)
                .collect::<Vec<_>>()
                .join(", ");
            if let Some(d) = dest {
                Ok(format!("{} = {}({});", var_name(*d), function, args_str))
            } else {
                Ok(format!("{}({});", function, args_str))
            }
        }
        Instruction::Phi { .. } => {
            // Phi nodes should be eliminated before codegen
            Ok("// phi node".to_string())
        }
        Instruction::DomainConversion { dest, source, from_domain, to_domain, encoding } => {
            // Domain conversions are handled by orchestrator, not in WGSL
            // Just pass through the value
            Ok(format!(
                "{} = {}; // conversion {:?} -> {:?} ({:?})",
                var_name(*dest),
                codegen_value(source),
                from_domain,
                to_domain,
                encoding
            ))
        }
    }
}

fn codegen_terminator(term: &Terminator) -> Result<String> {
    match term {
        Terminator::Return(val) => Ok(format!("return {};", codegen_value(val))),
        Terminator::ReturnVoid => Ok("return;".to_string()),
        Terminator::Branch { .. } | Terminator::Jump(_) => {
            // Control flow should be handled differently in WGSL
            Ok("// branch".to_string())
        }
    }
}

fn codegen_value(val: &Value) -> String {
    match val {
        Value::Var(v) => var_name(*v),
        Value::Int(n) => format!("{}", n),
        Value::Float(f) => format!("{}", f),
        Value::Bool(b) => format!("{}", b),
        Value::Array(elements) => {
            let elems_str = elements.iter().map(codegen_value).collect::<Vec<_>>().join(", ");
            format!("array({})", elems_str)
        }
    }
}

fn var_name(var: SSAVar) -> String {
    format!("v{}", var.id)
}

fn wgsl_type(ty: &IRType) -> String {
    match ty {
        IRType::Int => "i32".to_string(),
        IRType::Float => "f32".to_string(),
        IRType::Bool => "bool".to_string(),
        IRType::Array(elem, Some(size)) => format!("array<{}, {}>", wgsl_type(elem), size),
        IRType::Array(elem, None) => format!("array<{}>", wgsl_type(elem)),
        IRType::Qubit => "u32".to_string(), // Placeholder
        IRType::Void => "void".to_string(),
    }
}

fn wgsl_binop(op: BinOp) -> &'static str {
    match op {
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
        BinOp::And => "&&",
        BinOp::Or => "||",
    }
}

fn wgsl_unop(op: UnOp) -> &'static str {
    match op {
        UnOp::Neg => "-",
        UnOp::Not => "!",
    }
}

fn get_dest_var(inst: &Instruction) -> Option<SSAVar> {
    match inst {
        Instruction::Assign { dest, .. }
        | Instruction::BinaryOp { dest, .. }
        | Instruction::UnaryOp { dest, .. }
        | Instruction::Load { dest, .. }
        | Instruction::Phi { dest, .. } => Some(*dest),
        Instruction::Call { dest, .. } => *dest,
        _ => None,
    }
}

fn infer_var_type(inst: &Instruction) -> String {
    // Simplified type inference for WGSL variables
    match inst {
        Instruction::Assign { value, .. } => match value {
            Value::Int(_) => "i32".to_string(),
            Value::Float(_) => "f32".to_string(),
            Value::Bool(_) => "bool".to_string(),
            _ => "i32".to_string(), // Default
        },
        Instruction::BinaryOp { op, .. } => match op {
            BinOp::Eq | BinOp::Ne | BinOp::Lt | BinOp::Le | BinOp::Gt | BinOp::Ge | BinOp::And | BinOp::Or => "bool".to_string(),
            _ => "i32".to_string(),
        },
        Instruction::UnaryOp { op, .. } => match op {
            UnOp::Not => "bool".to_string(),
            UnOp::Neg => "i32".to_string(),
        },
        _ => "i32".to_string(),
    }
}


