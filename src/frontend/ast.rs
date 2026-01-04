/// Abstract Syntax Tree definitions for QuarkDSL

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq)]
pub struct Program {
    pub functions: Vec<Function>,
}

/// Execution domain for functions
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum Domain {
    Classical,  // CPU execution (default)
    Gpu,        // GPU execution (@gpu)
    Quantum,    // Quantum execution (@quantum)
}

#[derive(Debug, Clone, PartialEq)]
pub struct Function {
    pub name: String,
    pub params: Vec<Param>,
    pub return_type: Type,
    pub body: Vec<Statement>,
    pub domain: Domain,  // NEW: execution domain
}

#[derive(Debug, Clone, PartialEq)]
pub struct Param {
    pub name: String,
    pub ty: Type,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Type {
    Int,
    Float,
    Bool,
    Array(Box<Type>, Option<usize>), // element type, optional size
    Qubit,
    Void,
    Tensor(Box<Type>),  // NEW: GPU tensor type, e.g., tensor<float>
    QState,             // NEW: Quantum state type
}

#[derive(Debug, Clone, PartialEq)]
pub enum Statement {
    Let {
        name: String,
        ty: Option<Type>,
        value: Expression,
    },
    Assign {
        target: String,
        index: Option<Box<Expression>>,
        value: Expression,
    },
    Return(Expression),
    Expression(Expression),
    For {
        var: String,
        start: Expression,
        end: Expression,
        body: Vec<Statement>,
    },
    If {
        condition: Expression,
        then_body: Vec<Statement>,
        else_body: Option<Vec<Statement>>,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub enum Expression {
    IntLiteral(i64),
    FloatLiteral(f64),
    BoolLiteral(bool),
    Variable(String),
    ArrayLiteral(Vec<Expression>),
    Index {
        array: Box<Expression>,
        index: Box<Expression>,
    },
    Binary {
        op: BinaryOp,
        left: Box<Expression>,
        right: Box<Expression>,
    },
    Unary {
        op: UnaryOp,
        operand: Box<Expression>,
    },
    Call {
        function: String,
        args: Vec<Expression>,
    },
    Map {
        function: String,
        array: Box<Expression>,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BinaryOp {
    Add,
    Sub,
    Mul,
    Div,
    Mod,
    Eq,
    Ne,
    Lt,
    Le,
    Gt,
    Ge,
    And,
    Or,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UnaryOp {
    Neg,
    Not,
}

impl std::fmt::Display for Type {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Type::Int => write!(f, "int"),
            Type::Float => write!(f, "float"),
            Type::Bool => write!(f, "bool"),
            Type::Array(elem, Some(size)) => write!(f, "[{}; {}]", elem, size),
            Type::Array(elem, None) => write!(f, "[{}]", elem),
            Type::Qubit => write!(f, "qubit"),
            Type::Void => write!(f, "void"),
            Type::Tensor(elem) => write!(f, "tensor<{}>", elem),
            Type::QState => write!(f, "qstate"),
        }
    }
}

