use super::ast::*;
use anyhow::{bail, Result};
use std::collections::HashMap;

pub struct TypeChecker {
    variables: HashMap<String, Type>,
    functions: HashMap<String, (Vec<Type>, Type, Domain)>, // (param_types, return_type, domain)
    current_domain: Domain, // Track current function's domain
}

impl TypeChecker {
    fn new() -> Self {
        let mut checker = Self {
            variables: HashMap::new(),
            functions: HashMap::new(),
            current_domain: Domain::Classical,
        };

        // Register built-in quantum functions
        checker.register_builtin_functions();

        checker
    }

    fn register_builtin_functions(&mut self) {
        // I/O functions (Classical domain)
        self.functions.insert(
            "print".to_string(),
            (vec![Type::Int], Type::Void, Domain::Classical),
        );
        self.functions.insert(
            "print_float".to_string(),
            (vec![Type::Float], Type::Void, Domain::Classical),
        );
        self.functions.insert(
            "print_array".to_string(),
            (vec![Type::Array(Box::new(Type::Float), None)], Type::Void, Domain::Classical),
        );

        // Quantum gates (single qubit)
        self.functions.insert(
            "h".to_string(),
            (vec![Type::Int], Type::Int, Domain::Quantum),
        );
        self.functions.insert(
            "x".to_string(),
            (vec![Type::Int], Type::Int, Domain::Quantum),
        );
        self.functions.insert(
            "y".to_string(),
            (vec![Type::Int], Type::Int, Domain::Quantum),
        );
        self.functions.insert(
            "z".to_string(),
            (vec![Type::Int], Type::Int, Domain::Quantum),
        );
        self.functions.insert(
            "ry".to_string(),
            (vec![Type::Int, Type::Float], Type::Int, Domain::Quantum),
        );
        self.functions.insert(
            "rz".to_string(),
            (vec![Type::Int, Type::Float], Type::Int, Domain::Quantum),
        );

        // Quantum gates (two qubit)
        self.functions.insert(
            "cx".to_string(),
            (vec![Type::Int, Type::Int], Type::Int, Domain::Quantum),
        );
        self.functions.insert(
            "cnot".to_string(),
            (vec![Type::Int, Type::Int], Type::Int, Domain::Quantum),
        );

        // Measurement
        self.functions.insert(
            "measure".to_string(),
            (vec![Type::Int], Type::Int, Domain::Quantum),
        );
    }

    fn check_program(&mut self, program: &Program) -> Result<()> {
        // First pass: collect function signatures with domains
        for func in &program.functions {
            let param_types = func.params.iter().map(|p| p.ty.clone()).collect();
            self.functions.insert(
                func.name.clone(),
                (param_types, func.return_type.clone(), func.domain.clone()),
            );
        }

        // Second pass: type check function bodies
        for func in &program.functions {
            self.check_function(func)?;
        }

        Ok(())
    }

    fn check_function(&mut self, func: &Function) -> Result<()> {
        // Clear variables for new function scope
        self.variables.clear();

        // Set current domain
        self.current_domain = func.domain.clone();

        // Add parameters to scope
        for param in &func.params {
            self.variables.insert(param.name.clone(), param.ty.clone());
        }

        // Check statements
        for stmt in &func.body {
            self.check_statement(stmt)?;
        }

        Ok(())
    }

    fn check_statement(&mut self, stmt: &Statement) -> Result<()> {
        match stmt {
            Statement::Let { name, ty, value } => {
                let value_type = self.infer_expression(value)?;
                if let Some(declared_ty) = ty {
                    if !self.types_compatible(declared_ty, &value_type) {
                        bail!(
                            "Type mismatch: expected {}, got {}",
                            declared_ty,
                            value_type
                        );
                    }
                    self.variables.insert(name.clone(), declared_ty.clone());
                } else {
                    self.variables.insert(name.clone(), value_type);
                }
                Ok(())
            }
            Statement::Assign {
                target,
                index,
                value,
            } => {
                let var_type = self
                    .variables
                    .get(target)
                    .ok_or_else(|| anyhow::anyhow!("Undefined variable: {}", target))?
                    .clone();

                let value_type = self.infer_expression(value)?;

                if let Some(idx_expr) = index {
                    // Array assignment
                    let idx_type = self.infer_expression(idx_expr)?;
                    if idx_type != Type::Int {
                        bail!("Array index must be int, got {}", idx_type);
                    }
                    if let Type::Array(elem_type, _) = var_type {
                        if !self.types_compatible(&elem_type, &value_type) {
                            bail!(
                                "Type mismatch in array assignment: expected {}, got {}",
                                elem_type,
                                value_type
                            );
                        }
                    } else {
                        bail!("Cannot index non-array type {}", var_type);
                    }
                } else {
                    if !self.types_compatible(&var_type, &value_type) {
                        bail!(
                            "Type mismatch in assignment: expected {}, got {}",
                            var_type,
                            value_type
                        );
                    }
                }
                Ok(())
            }
            Statement::Return(expr) => {
                self.infer_expression(expr)?;
                Ok(())
            }
            Statement::Expression(expr) => {
                self.infer_expression(expr)?;
                Ok(())
            }
            Statement::For {
                var,
                start,
                end,
                body,
            } => {
                let start_type = self.infer_expression(start)?;
                let end_type = self.infer_expression(end)?;
                if start_type != Type::Int || end_type != Type::Int {
                    bail!("For loop bounds must be int");
                }
                self.variables.insert(var.clone(), Type::Int);
                for stmt in body {
                    self.check_statement(stmt)?;
                }
                Ok(())
            }
            Statement::If {
                condition,
                then_body,
                else_body,
            } => {
                let cond_type = self.infer_expression(condition)?;
                if cond_type != Type::Bool {
                    bail!("If condition must be bool, got {}", cond_type);
                }
                for stmt in then_body {
                    self.check_statement(stmt)?;
                }
                if let Some(else_stmts) = else_body {
                    for stmt in else_stmts {
                        self.check_statement(stmt)?;
                    }
                }
                Ok(())
            }
        }
    }

    fn infer_expression(&self, expr: &Expression) -> Result<Type> {
        match expr {
            Expression::IntLiteral(_) => Ok(Type::Int),
            Expression::FloatLiteral(_) => Ok(Type::Float),
            Expression::BoolLiteral(_) => Ok(Type::Bool),
            Expression::Variable(name) => self
                .variables
                .get(name)
                .cloned()
                .ok_or_else(|| anyhow::anyhow!("Undefined variable: {}", name)),
            Expression::ArrayLiteral(elements) => {
                if elements.is_empty() {
                    bail!("Cannot infer type of empty array");
                }
                let first_type = self.infer_expression(&elements[0])?;
                for elem in &elements[1..] {
                    let elem_type = self.infer_expression(elem)?;
                    if !self.types_compatible(&first_type, &elem_type) {
                        bail!("Array elements must have same type");
                    }
                }
                Ok(Type::Array(Box::new(first_type), Some(elements.len())))
            }
            Expression::Index { array, index } => {
                let array_type = self.infer_expression(array)?;
                let index_type = self.infer_expression(index)?;
                if index_type != Type::Int {
                    bail!("Array index must be int");
                }
                match array_type {
                    Type::Array(elem_type, _) => Ok(*elem_type),
                    _ => bail!("Cannot index non-array type"),
                }
            }
            Expression::Binary { op, left, right } => {
                let left_type = self.infer_expression(left)?;
                let right_type = self.infer_expression(right)?;

                use BinaryOp::*;
                match op {
                    Add | Sub | Mul | Div | Mod => {
                        if left_type == Type::Int && right_type == Type::Int {
                            Ok(Type::Int)
                        } else if left_type == Type::Float && right_type == Type::Float {
                            Ok(Type::Float)
                        } else {
                            bail!("Type mismatch in arithmetic operation");
                        }
                    }
                    Eq | Ne | Lt | Le | Gt | Ge => {
                        if !self.types_compatible(&left_type, &right_type) {
                            bail!("Type mismatch in comparison");
                        }
                        Ok(Type::Bool)
                    }
                    And | Or => {
                        if left_type != Type::Bool || right_type != Type::Bool {
                            bail!("Logical operators require bool operands");
                        }
                        Ok(Type::Bool)
                    }
                }
            }
            Expression::Unary { op, operand } => {
                let operand_type = self.infer_expression(operand)?;
                match op {
                    UnaryOp::Neg => {
                        if operand_type == Type::Int || operand_type == Type::Float {
                            Ok(operand_type)
                        } else {
                            bail!("Negation requires numeric type");
                        }
                    }
                    UnaryOp::Not => {
                        if operand_type == Type::Bool {
                            Ok(Type::Bool)
                        } else {
                            bail!("Logical not requires bool");
                        }
                    }
                }
            }
            Expression::Call { function, args } => {
                let (param_types, return_type, target_domain) = self
                    .functions
                    .get(function)
                    .ok_or_else(|| anyhow::anyhow!("Undefined function: {}", function))?
                    .clone();

                // Check for cross-domain calls (hybrid feature)
                if self.current_domain != target_domain {
                    // Cross-domain call detected
                    // For now, we allow it (automatic conversion will be inserted later)
                    // In the future, we can add warnings or restrictions here
                    eprintln!(
                        "INFO: Cross-domain call from {:?} to {:?} function '{}'",
                        self.current_domain, target_domain, function
                    );
                }

                if args.len() != param_types.len() {
                    bail!(
                        "Function {} expects {} arguments, got {}",
                        function,
                        param_types.len(),
                        args.len()
                    );
                }

                for (arg, param_type) in args.iter().zip(param_types.iter()) {
                    let arg_type = self.infer_expression(arg)?;
                    if !self.types_compatible(param_type, &arg_type) {
                        bail!("Argument type mismatch: expected {}, got {}", param_type, arg_type);
                    }
                }

                Ok(return_type)
            }
            Expression::Map { function, array } => {
                let array_type = self.infer_expression(array)?;
                let (param_types, return_type, _domain) = self
                    .functions
                    .get(function)
                    .ok_or_else(|| anyhow::anyhow!("Undefined function: {}", function))?
                    .clone();

                if param_types.len() != 1 {
                    bail!("Map function must take exactly one argument");
                }

                match array_type {
                    Type::Array(elem_type, size) => {
                        if !self.types_compatible(&param_types[0], &elem_type) {
                            bail!("Map function parameter type mismatch");
                        }
                        Ok(Type::Array(Box::new(return_type), size))
                    }
                    _ => bail!("Map requires array argument"),
                }
            }
        }
    }

    fn types_compatible(&self, expected: &Type, actual: &Type) -> bool {
        match (expected, actual) {
            (Type::Array(e1, _), Type::Array(e2, _)) => self.types_compatible(e1, e2),
            (Type::Tensor(e1), Type::Tensor(e2)) => self.types_compatible(e1, e2),
            // Allow implicit conversion: Array → Tensor (for hybrid workflows)
            (Type::Tensor(e1), Type::Array(e2, _)) => self.types_compatible(e1, e2),
            (Type::Array(e1, _), Type::Tensor(e2)) => self.types_compatible(e1, e2),
            _ => expected == actual,
        }
    }
}

pub fn typecheck(program: &Program) -> Result<()> {
    let mut checker = TypeChecker::new();
    checker.check_program(program)
}


