pub mod ast;
mod lexer;
mod parser;
mod typecheck;

pub use parser::parse;
pub use typecheck::typecheck;

