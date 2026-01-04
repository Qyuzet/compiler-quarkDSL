use super::ir::*;
use crate::frontend::ast;
use anyhow::Result;
use std::collections::HashMap;

pub struct Lowerer {
    current_block: Option<BasicBlock>,
    var_counter: usize,
    var_map: HashMap<String, SSAVar>,
    function_domains: HashMap<String, ast::Domain>, // Track function domains
    current_domain: ast::Domain, // Current function's domain
}

impl Lowerer {
    fn new() -> Self {
        Self {
            current_block: None,
            var_counter: 0,
            var_map: HashMap::new(),
            function_domains: HashMap::new(),
            current_domain: ast::Domain::Classical,
        }
    }

    fn fresh_var(&mut self) -> SSAVar {
        let id = self.var_counter;
        self.var_counter += 1;
        SSAVar::new(id)
    }

    fn lower_module(&mut self, program: &ast::Program) -> Result<Module> {
        let mut functions = Vec::new();

        // First pass: collect function domains
        for func in &program.functions {
            self.function_domains.insert(func.name.clone(), func.domain.clone());
        }

        // Second pass: lower functions
        for func in &program.functions {
            functions.push(self.lower_function(func)?);
        }

        Ok(Module { functions })
    }

    fn lower_function(&mut self, func: &ast::Function) -> Result<IRFunction> {
        self.var_counter = 0;
        self.var_map.clear();
        self.current_domain = func.domain.clone(); // Set current domain

        let params: Vec<(String, IRType)> = func
            .params
            .iter()
            .map(|p| (p.name.clone(), self.convert_type(&p.ty)))
            .collect();

        // Add parameters to var_map
        for (name, _) in &params {
            let var = self.fresh_var();
            self.var_map.insert(name.clone(), var);
        }

        let return_type = self.convert_type(&func.return_type);

        // Create entry block
        self.current_block = Some(BasicBlock {
            label: "entry".to_string(),
            instructions: Vec::new(),
            terminator: Terminator::ReturnVoid,
        });

        let mut blocks = Vec::new();

        // Lower statements
        for stmt in &func.body {
            self.lower_statement(stmt)?;
        }

        // Finalize current block
        if let Some(block) = self.current_block.take() {
            blocks.push(block);
        }

        Ok(IRFunction {
            name: func.name.clone(),
            params,
            return_type,
            blocks,
            next_var_id: self.var_counter,
            domain: func.domain.clone(), // Pass domain to IR
        })
    }

    fn lower_statement(&mut self, stmt: &ast::Statement) -> Result<()> {
        match stmt {
            ast::Statement::Let { name, value, .. } => {
                let val = self.lower_expression(value)?;
                let dest = self.fresh_var();
                self.var_map.insert(name.clone(), dest);

                self.emit_instruction(Instruction::Assign {
                    dest,
                    value: val,
                });
                Ok(())
            }
            ast::Statement::Assign {
                target,
                index,
                value,
            } => {
                let val = self.lower_expression(value)?;
                let var = *self
                    .var_map
                    .get(target)
                    .ok_or_else(|| anyhow::anyhow!("Undefined variable: {}", target))?;

                if let Some(idx_expr) = index {
                    let idx = self.lower_expression(idx_expr)?;
                    self.emit_instruction(Instruction::Store {
                        array: var,
                        index: idx,
                        value: val,
                    });
                } else {
                    self.emit_instruction(Instruction::Assign { dest: var, value: val });
                }
                Ok(())
            }
            ast::Statement::Return(expr) => {
                let val = self.lower_expression(expr)?;
                if let Some(block) = &mut self.current_block {
                    block.terminator = Terminator::Return(val);
                }
                Ok(())
            }
            ast::Statement::Expression(expr) => {
                self.lower_expression(expr)?;
                Ok(())
            }
            ast::Statement::For {
                var,
                start,
                end,
                body,
            } => {
                // Loop unrolling: evaluate start and end as constants
                let start_val = self.lower_expression(start)?;
                let end_val = self.lower_expression(end)?;

                // Extract constant values for unrolling
                if let (Value::Int(start_int), Value::Int(end_int)) = (&start_val, &end_val) {
                    // Unroll loop iterations
                    for i in *start_int..*end_int {
                        // Create new loop variable for this iteration
                        let loop_var = self.fresh_var();
                        self.var_map.insert(var.clone(), loop_var);
                        self.emit_instruction(Instruction::Assign {
                            dest: loop_var,
                            value: Value::Int(i),
                        });

                        // Lower body for this iteration
                        for stmt in body {
                            self.lower_statement(stmt)?;
                        }
                    }
                } else {
                    // Fallback: single iteration with start value
                    let loop_var = self.fresh_var();
                    self.var_map.insert(var.clone(), loop_var);
                    self.emit_instruction(Instruction::Assign {
                        dest: loop_var,
                        value: start_val,
                    });

                    for stmt in body {
                        self.lower_statement(stmt)?;
                    }
                }

                Ok(())
            }
            ast::Statement::If {
                condition,
                then_body,
                else_body,
            } => {
                let _cond = self.lower_expression(condition)?;

                // For now, simplified (not creating separate blocks)
                for stmt in then_body {
                    self.lower_statement(stmt)?;
                }

                if let Some(else_stmts) = else_body {
                    for stmt in else_stmts {
                        self.lower_statement(stmt)?;
                    }
                }

                Ok(())
            }
        }
    }

    fn lower_expression(&mut self, expr: &ast::Expression) -> Result<Value> {
        match expr {
            ast::Expression::IntLiteral(n) => Ok(Value::Int(*n)),
            ast::Expression::FloatLiteral(f) => Ok(Value::Float(*f)),
            ast::Expression::BoolLiteral(b) => Ok(Value::Bool(*b)),
            ast::Expression::Variable(name) => {
                let var = *self
                    .var_map
                    .get(name)
                    .ok_or_else(|| anyhow::anyhow!("Undefined variable: {}", name))?;
                Ok(Value::Var(var))
            }
            ast::Expression::ArrayLiteral(elements) => {
                let values: Result<Vec<Value>> =
                    elements.iter().map(|e| self.lower_expression(e)).collect();
                Ok(Value::Array(values?))
            }
            ast::Expression::Index { array, index } => {
                let arr_val = self.lower_expression(array)?;
                let idx_val = self.lower_expression(index)?;

                // Extract the SSAVar from array
                if let Value::Var(arr_var) = arr_val {
                    let dest = self.fresh_var();
                    self.emit_instruction(Instruction::Load {
                        dest,
                        array: arr_var,
                        index: idx_val,
                    });
                    Ok(Value::Var(dest))
                } else {
                    anyhow::bail!("Array indexing requires variable")
                }
            }
            ast::Expression::Binary { op, left, right } => {
                let left_val = self.lower_expression(left)?;
                let right_val = self.lower_expression(right)?;
                let dest = self.fresh_var();

                let ir_op = self.convert_binop(*op);
                self.emit_instruction(Instruction::BinaryOp {
                    dest,
                    op: ir_op,
                    left: left_val,
                    right: right_val,
                });

                Ok(Value::Var(dest))
            }
            ast::Expression::Unary { op, operand } => {
                let operand_val = self.lower_expression(operand)?;
                let dest = self.fresh_var();

                let ir_op = self.convert_unop(*op);
                self.emit_instruction(Instruction::UnaryOp {
                    dest,
                    op: ir_op,
                    operand: operand_val,
                });

                Ok(Value::Var(dest))
            }
            ast::Expression::Call { function, args } => {
                let arg_vals: Result<Vec<Value>> =
                    args.iter().map(|a| self.lower_expression(a)).collect();
                let arg_vals = arg_vals?;

                // Built-in functions - don't convert
                let builtin_quantum_fns = [
                    "h", "x", "y", "z", "rx", "ry", "rz",
                    "cx", "cnot", "cz", "measure"
                ];
                let builtin_io_fns = ["print", "print_float", "print_array"];
                let is_builtin = builtin_quantum_fns.contains(&function.as_str())
                    || builtin_io_fns.contains(&function.as_str());

                // Check if this is a cross-domain call
                let target_domain = self.function_domains.get(function)
                    .cloned()
                    .unwrap_or(ast::Domain::Classical);

                // If cross-domain (and not builtin), convert arguments
                let converted_args = if !is_builtin && self.current_domain != target_domain {
                    eprintln!(
                        "INFO: Inserting conversion for {:?} → {:?} call to '{}'",
                        self.current_domain, target_domain, function
                    );

                    // Convert each argument
                    arg_vals.iter().map(|arg| {
                        let conv_dest = self.fresh_var();
                        let encoding = match (&self.current_domain, &target_domain) {
                            (ast::Domain::Gpu, ast::Domain::Quantum) |
                            (ast::Domain::Classical, ast::Domain::Quantum) => {
                                ConversionEncoding::AngleEncoding
                            }
                            (ast::Domain::Quantum, ast::Domain::Gpu) |
                            (ast::Domain::Quantum, ast::Domain::Classical) => {
                                ConversionEncoding::MeasurementExtract
                            }
                            _ => ConversionEncoding::AngleEncoding, // Default
                        };

                        self.emit_instruction(Instruction::DomainConversion {
                            dest: conv_dest,
                            source: arg.clone(),
                            from_domain: self.current_domain.clone(),
                            to_domain: target_domain.clone(),
                            encoding,
                        });

                        Value::Var(conv_dest)
                    }).collect()
                } else {
                    arg_vals
                };

                let dest = self.fresh_var();
                self.emit_instruction(Instruction::Call {
                    dest: Some(dest),
                    function: function.clone(),
                    args: converted_args,
                });

                Ok(Value::Var(dest))
            }
            ast::Expression::Map { function, array } => {
                // Map is a higher-level construct that will be optimized/expanded later
                // For now, treat it as a call
                let arr_val = self.lower_expression(array)?;
                let dest = self.fresh_var();
                self.emit_instruction(Instruction::Call {
                    dest: Some(dest),
                    function: format!("map_{}", function),
                    args: vec![arr_val],
                });
                Ok(Value::Var(dest))
            }
        }
    }

    fn emit_instruction(&mut self, inst: Instruction) {
        if let Some(block) = &mut self.current_block {
            block.instructions.push(inst);
        }
    }

    fn convert_type(&self, ty: &ast::Type) -> IRType {
        match ty {
            ast::Type::Int => IRType::Int,
            ast::Type::Float => IRType::Float,
            ast::Type::Bool => IRType::Bool,
            ast::Type::Array(elem, size) => {
                IRType::Array(Box::new(self.convert_type(elem)), *size)
            }
            ast::Type::Qubit => IRType::Qubit,
            ast::Type::Void => IRType::Void,
            ast::Type::Tensor(elem) => {
                // For now, treat tensor<T> as array<T> in IR
                // Later we'll add proper IR support for tensors
                IRType::Array(Box::new(self.convert_type(elem)), None)
            }
            ast::Type::QState => {
                // For now, treat qstate as opaque type
                // Later we'll add proper IR support
                IRType::Qubit  // Placeholder
            }
        }
    }

    fn convert_binop(&self, op: ast::BinaryOp) -> BinOp {
        match op {
            ast::BinaryOp::Add => BinOp::Add,
            ast::BinaryOp::Sub => BinOp::Sub,
            ast::BinaryOp::Mul => BinOp::Mul,
            ast::BinaryOp::Div => BinOp::Div,
            ast::BinaryOp::Mod => BinOp::Mod,
            ast::BinaryOp::Eq => BinOp::Eq,
            ast::BinaryOp::Ne => BinOp::Ne,
            ast::BinaryOp::Lt => BinOp::Lt,
            ast::BinaryOp::Le => BinOp::Le,
            ast::BinaryOp::Gt => BinOp::Gt,
            ast::BinaryOp::Ge => BinOp::Ge,
            ast::BinaryOp::And => BinOp::And,
            ast::BinaryOp::Or => BinOp::Or,
        }
    }

    fn convert_unop(&self, op: ast::UnaryOp) -> UnOp {
        match op {
            ast::UnaryOp::Neg => UnOp::Neg,
            ast::UnaryOp::Not => UnOp::Not,
        }
    }
}

pub fn lower_to_ir(program: &ast::Program) -> Result<Module> {
    let mut lowerer = Lowerer::new();
    lowerer.lower_module(program)
}


