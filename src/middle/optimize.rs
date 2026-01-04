// Optimization: Improve program performance without changing semantics
// Dataflow Analysis: Analyze how data flows through the program
// SSA Form: Simplifies optimization by making def-use chains explicit

use super::ir::*;
use std::collections::{HashMap, HashSet};

// Optimization Pipeline: Multiple passes for better results
pub fn optimize(module: &mut Module) {
    eprintln!("INFO: Running optimization passes...");
    for func in &mut module.functions {
        eprintln!("INFO: Optimizing function '{}'", func.name);
        optimize_function(func);
    }
    eprintln!("INFO: Optimization complete");
}

// Function-level optimization: Apply multiple passes iteratively
// Iterative Dataflow Analysis: Repeat until fixed point
fn optimize_function(func: &mut IRFunction) {
    // Run optimization passes in order (multiple iterations for better results)
    for _ in 0..3 {
        copy_propagation(func);                    // Replace copies with originals
        constant_folding(func);                    // Evaluate constants at compile time
        inline_single_use_vars(func);              // Inline single-use expressions
        common_subexpression_elimination(func);    // CSE: Reuse computed values
        dead_code_elimination(func);               // DCE: Remove unused code
    }
    // TODO: map_fusion, LICM (Loop-Invariant Code Motion)
}

/// Copy Propagation: Replace variable uses with their assigned values
/// Dataflow Analysis: Forward propagation of copy assignments
/// Example: x = y; z = x + 1; → z = y + 1;
fn copy_propagation(func: &mut IRFunction) {
    let mut copy_map: HashMap<SSAVar, Value> = HashMap::new();

    // Build copy map: v = x -> replace all uses of v with x
    // Reaching Definitions: Track which assignments reach each use
    for block in &func.blocks {
        for inst in &block.instructions {
            if let Instruction::Assign { dest, value } = inst {
                // Propagate constants and variable copies
                match value {
                    Value::Var(_) | Value::Int(_) | Value::Float(_) | Value::Bool(_) => {
                        copy_map.insert(*dest, value.clone());
                    }
                    _ => {}
                }
            }
        }
    }

    // Replace uses with propagated values
    // Def-Use Chain: Follow uses of each definition
    for block in &mut func.blocks {
        for inst in &mut block.instructions {
            replace_value_uses(inst, &copy_map);
        }
        replace_terminator_uses(&mut block.terminator, &copy_map);
    }
}

/// Inline Single-Use Variables - replace variables used only once with their values
fn inline_single_use_vars(func: &mut IRFunction) {
    // This optimization is complex and can break code if not done carefully
    // For now, copy propagation + DCE already handles most cases
    // TODO: Implement safe expression inlining for Load and BinaryOp
}

/// Constant Folding: Evaluate constant expressions at compile time
/// Optimization: Reduce runtime computation by computing at compile time
/// Example: x = 2 + 3; → x = 5;
fn constant_folding(func: &mut IRFunction) {
    for block in &mut func.blocks {
        for inst in &mut block.instructions {
            if let Instruction::BinaryOp { dest, op, left, right } = inst {
                // Try to fold if both operands are constants
                // Constant Propagation: Use known constant values
                if let (Value::Int(l), Value::Int(r)) = (&*left, &*right) {
                    let result = match op {
                        BinOp::Add => Some(*l + *r),
                        BinOp::Sub => Some(*l - *r),
                        BinOp::Mul => Some(*l * *r),
                        BinOp::Div if *r != 0 => Some(*l / *r),
                        _ => None,
                    };
                    if let Some(val) = result {
                        *inst = Instruction::Assign {
                            dest: *dest,
                            value: Value::Int(val),
                        };
                    }
                } else if let (Value::Float(l), Value::Float(r)) = (&*left, &*right) {
                    let result = match op {
                        BinOp::Add => Some(*l + *r),
                        BinOp::Sub => Some(*l - *r),
                        BinOp::Mul => Some(*l * *r),
                        BinOp::Div if *r != 0.0 => Some(*l / *r),
                        _ => None,
                    };
                    if let Some(val) = result {
                        *inst = Instruction::Assign {
                            dest: *dest,
                            value: Value::Float(val),
                        };
                    }
                }
            }
        }
    }
}

/// Dead Code Elimination (DCE): Remove instructions whose results are never used
/// Liveness Analysis: Determine which variables are live at each program point
/// Example: x = 5; y = 3; return y; → y = 3; return y; (x is dead)
fn dead_code_elimination(func: &mut IRFunction) {
    let mut used_vars = HashSet::new();

    // Liveness Analysis: Mark variables that are live (used)
    // Backward analysis: Start from uses and work back to definitions
    for block in &func.blocks {
        // Mark variables in terminator (always live)
        match &block.terminator {
            Terminator::Return(val) => mark_value_used(val, &mut used_vars),
            Terminator::Branch { condition, .. } => mark_value_used(condition, &mut used_vars),
            _ => {}
        }

        // Mark variables in side-effecting instructions
        for inst in &block.instructions {
            match inst {
                Instruction::Store { array, index, value } => {
                    // Store is side-effecting - mark array and all operands as used
                    used_vars.insert(*array);
                    mark_value_used(index, &mut used_vars);
                    mark_value_used(value, &mut used_vars);
                }
                Instruction::Call { args, .. } => {
                    for arg in args {
                        mark_value_used(arg, &mut used_vars);
                    }
                }
                Instruction::DomainConversion { source, .. } => {
                    mark_value_used(source, &mut used_vars);
                }
                _ => {}
            }
        }
    }

    // Iteratively mark variables that are used
    let mut changed = true;
    while changed {
        changed = false;
        for block in &func.blocks {
            for inst in &block.instructions {
                if let Some(dest) = get_dest(inst) {
                    if used_vars.contains(&dest) {
                        // Mark operands as used
                        for operand in get_operands(inst) {
                            if let Value::Var(v) = operand {
                                if used_vars.insert(*v) {
                                    changed = true;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Remove unused instructions
    for block in &mut func.blocks {
        block.instructions.retain(|inst| {
            if let Some(dest) = get_dest(inst) {
                used_vars.contains(&dest) || is_side_effecting(inst)
            } else {
                true
            }
        });
    }
}

/// Common Subexpression Elimination (CSE): Reuse previously computed values
/// Available Expressions: Track which expressions have been computed
/// Example: a = b + c; d = b + c; → a = b + c; d = a;
fn common_subexpression_elimination(func: &mut IRFunction) {
    let mut expr_map: HashMap<String, SSAVar> = HashMap::new();

    // Available Expressions Analysis: Track computed expressions
    for block in &mut func.blocks {
        for inst in &mut block.instructions {
            match inst {
                Instruction::BinaryOp {
                    dest,
                    op,
                    left,
                    right,
                } => {
                    // Hash expression for lookup
                    let expr_key = format!("{:?} {:?} {:?}", op, left, right);
                    if let Some(&existing_var) = expr_map.get(&expr_key) {
                        // Expression already computed, reuse result
                        // Replace computation with copy
                        *inst = Instruction::Assign {
                            dest: *dest,
                            value: Value::Var(existing_var),
                        };
                    } else {
                        // First occurrence, record it
                        expr_map.insert(expr_key, *dest);
                    }
                }
                _ => {}
            }
        }
    }
}

fn mark_value_used(val: &Value, used: &mut HashSet<SSAVar>) {
    if let Value::Var(v) = val {
        used.insert(*v);
    } else if let Value::Array(elements) = val {
        for elem in elements {
            mark_value_used(elem, used);
        }
    }
}

fn get_dest(inst: &Instruction) -> Option<SSAVar> {
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

fn get_operands(inst: &Instruction) -> Vec<&Value> {
    match inst {
        Instruction::Assign { value, .. } => vec![value],
        Instruction::BinaryOp { left, right, .. } => vec![left, right],
        Instruction::UnaryOp { operand, .. } => vec![operand],
        Instruction::Load { index, .. } => vec![index],
        Instruction::Store { index, value, .. } => vec![index, value],
        Instruction::Call { args, .. } => args.iter().collect(),
        Instruction::Phi { incoming, .. } => incoming.iter().map(|(v, _)| v).collect(),
        Instruction::DomainConversion { source, .. } => vec![source],
    }
}

fn get_operands_mut(inst: &mut Instruction) -> Vec<&mut Value> {
    match inst {
        Instruction::Assign { value, .. } => vec![value],
        Instruction::BinaryOp { left, right, .. } => vec![left, right],
        Instruction::UnaryOp { operand, .. } => vec![operand],
        Instruction::Load { index, .. } => vec![index],
        Instruction::Store { index, value, .. } => vec![index, value],
        Instruction::Call { args, .. } => args.iter_mut().collect(),
        Instruction::Phi { incoming, .. } => incoming.iter_mut().map(|(v, _)| v).collect(),
        Instruction::DomainConversion { source, .. } => vec![source],
    }
}

fn is_side_effecting(inst: &Instruction) -> bool {
    matches!(
        inst,
        Instruction::Store { .. } | Instruction::Call { .. } | Instruction::DomainConversion { .. }
    )
}

fn replace_value_uses(inst: &mut Instruction, copy_map: &HashMap<SSAVar, Value>) {
    match inst {
        Instruction::Assign { value, .. } => replace_value(value, copy_map),
        Instruction::BinaryOp { left, right, .. } => {
            replace_value(left, copy_map);
            replace_value(right, copy_map);
        }
        Instruction::UnaryOp { operand, .. } => replace_value(operand, copy_map),
        Instruction::Load { index, .. } => replace_value(index, copy_map),
        Instruction::Store { index, value, .. } => {
            replace_value(index, copy_map);
            replace_value(value, copy_map);
        }
        Instruction::Call { args, .. } => {
            for arg in args {
                replace_value(arg, copy_map);
            }
        }
        Instruction::DomainConversion { source, .. } => replace_value(source, copy_map),
        _ => {}
    }
}

fn replace_value(value: &mut Value, copy_map: &HashMap<SSAVar, Value>) {
    if let Value::Var(v) = value {
        if let Some(replacement) = copy_map.get(v) {
            *value = replacement.clone();
        }
    } else if let Value::Array(elements) = value {
        for elem in elements {
            replace_value(elem, copy_map);
        }
    }
}

fn replace_terminator_uses(term: &mut Terminator, copy_map: &HashMap<SSAVar, Value>) {
    match term {
        Terminator::Return(val) => replace_value(val, copy_map),
        Terminator::Branch { condition, .. } => replace_value(condition, copy_map),
        _ => {}
    }
}

fn count_value_uses(inst: &Instruction, use_count: &mut HashMap<SSAVar, usize>) {
    for operand in get_operands(inst) {
        count_value_in_value(operand, use_count);
    }
}

fn count_value_in_value(value: &Value, use_count: &mut HashMap<SSAVar, usize>) {
    match value {
        Value::Var(v) => *use_count.entry(*v).or_insert(0) += 1,
        Value::Array(elements) => {
            for elem in elements {
                count_value_in_value(elem, use_count);
            }
        }
        _ => {}
    }
}

fn count_terminator_uses(term: &Terminator, use_count: &mut HashMap<SSAVar, usize>) {
    match term {
        Terminator::Return(val) => count_value_in_value(val, use_count),
        Terminator::Branch { condition, .. } => count_value_in_value(condition, use_count),
        _ => {}
    }
}

fn inline_instruction_uses(inst: &mut Instruction, inline_map: &HashMap<SSAVar, Instruction>) {
    match inst {
        Instruction::Assign { value, .. } => inline_value_uses(value, inline_map),
        Instruction::BinaryOp { left, right, .. } => {
            inline_value_uses(left, inline_map);
            inline_value_uses(right, inline_map);
        }
        Instruction::UnaryOp { operand, .. } => inline_value_uses(operand, inline_map),
        Instruction::Load { index, .. } => inline_value_uses(index, inline_map),
        Instruction::Store { index, value, .. } => {
            inline_value_uses(index, inline_map);
            inline_value_uses(value, inline_map);
        }
        Instruction::Call { args, .. } => {
            for arg in args {
                inline_value_uses(arg, inline_map);
            }
        }
        Instruction::DomainConversion { source, .. } => inline_value_uses(source, inline_map),
        _ => {}
    }
}

fn inline_value_uses(value: &mut Value, inline_map: &HashMap<SSAVar, Instruction>) {
    if let Value::Var(v) = value {
        if let Some(inst) = inline_map.get(v) {
            // Replace with the value from the inlined instruction
            match inst {
                Instruction::Assign { value: val, .. } => {
                    *value = val.clone();
                }
                Instruction::Load { array, index, .. } => {
                    // Can't inline complex expressions into Value - keep as is
                    // This will be handled by backend
                }
                _ => {}
            }
        }
    } else if let Value::Array(elements) = value {
        for elem in elements {
            inline_value_uses(elem, inline_map);
        }
    }
}

fn inline_terminator_instruction_uses(term: &mut Terminator, inline_map: &HashMap<SSAVar, Instruction>) {
    match term {
        Terminator::Return(val) => inline_value_uses(val, inline_map),
        Terminator::Branch { condition, .. } => inline_value_uses(condition, inline_map),
        _ => {}
    }
}

