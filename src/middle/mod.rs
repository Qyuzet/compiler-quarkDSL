pub mod ir;
mod lower;
mod optimize;
mod dump;

pub use lower::lower_to_ir;
pub use optimize::optimize;
pub use dump::dump_ir;

