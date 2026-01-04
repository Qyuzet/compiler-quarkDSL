/// SSA-based Intermediate Representation
///
/// Static Single Assignment (SSA): Each variable is assigned exactly once
/// Three-Address Code: Instructions have at most three operands
/// Basic Blocks: Sequences of instructions with single entry and exit
/// Control Flow Graph (CFG): Graph of basic blocks connected by terminators

use serde::{Deserialize, Serialize};
use crate::frontend::ast::Domain;

// IR Module: Collection of functions (compilation unit)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Module {
    pub functions: Vec<IRFunction>,
}

// IR Function: SSA form with basic blocks
// Control Flow Graph: Represented as vector of basic blocks
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IRFunction {
    pub name: String,
    pub params: Vec<(String, IRType)>,
    pub return_type: IRType,
    pub blocks: Vec<BasicBlock>,           // CFG nodes
    pub next_var_id: usize,                // SSA variable counter
    pub domain: Domain,                    // Execution domain (GPU/Quantum)
}

// Basic Block: Sequence of instructions with single entry and exit
// Entry: Only first instruction can be reached from outside
// Exit: Only terminator transfers control outside
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BasicBlock {
    pub label: String,                     // Block identifier
    pub instructions: Vec<Instruction>,    // Straight-line code
    pub terminator: Terminator,            // Control flow transfer
}

// Three-Address Code Instructions
// Format: dest = operand1 op operand2
// SSA Property: Each dest is assigned exactly once
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Instruction {
    // dest = value (simple assignment)
    Assign {
        dest: SSAVar,                      // SSA variable (assigned once)
        value: Value,
    },
    // dest = left op right (binary operation)
    // Three-address code: result, operand1, operand2
    BinaryOp {
        dest: SSAVar,                      // SSA variable
        op: BinOp,
        left: Value,
        right: Value,
    },
    UnaryOp {
        dest: SSAVar,
        op: UnOp,
        operand: Value,
    },
    Load {
        dest: SSAVar,
        array: SSAVar,
        index: Value,
    },
    Store {
        array: SSAVar,
        index: Value,
        value: Value,
    },
    Call {
        dest: Option<SSAVar>,
        function: String,
        args: Vec<Value>,
    },
    Phi {
        dest: SSAVar,
        incoming: Vec<(Value, String)>, // (value, block_label)
    },
    /// Domain conversion: GPU ↔ Quantum
    DomainConversion {
        dest: SSAVar,
        source: Value,
        from_domain: Domain,
        to_domain: Domain,
        encoding: ConversionEncoding,
    },
}

/// Encoding method for domain conversions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConversionEncoding {
    AngleEncoding,      // GPU → Quantum: ry(qubit, angle)
    AmplitudeEncoding,  // GPU → Quantum: initialize(statevector)
    MeasurementExtract, // Quantum → GPU: measure + extract counts
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Terminator {
    Return(Value),
    ReturnVoid,
    Branch {
        condition: Value,
        true_label: String,
        false_label: String,
    },
    Jump(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SSAVar {
    pub id: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum Value {
    Var(SSAVar),
    Int(i64),
    Float(f64),
    Bool(bool),
    Array(Vec<Value>),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BinOp {
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum UnOp {
    Neg,
    Not,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum IRType {
    Int,
    Float,
    Bool,
    Array(Box<IRType>, Option<usize>),
    Qubit,
    Void,
}

impl SSAVar {
    pub fn new(id: usize) -> Self {
        Self { id }
    }
}

impl std::fmt::Display for SSAVar {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "%{}", self.id)
    }
}

impl std::fmt::Display for IRType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            IRType::Int => write!(f, "int"),
            IRType::Float => write!(f, "float"),
            IRType::Bool => write!(f, "bool"),
            IRType::Array(elem, Some(size)) => write!(f, "[{}; {}]", elem, size),
            IRType::Array(elem, None) => write!(f, "[{}]", elem),
            IRType::Qubit => write!(f, "qubit"),
            IRType::Void => write!(f, "void"),
        }
    }
}

