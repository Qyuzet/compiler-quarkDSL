use anyhow::{Context, Result};
use clap::{Parser, Subcommand, ValueEnum};
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "quarkdsl")]
#[command(about = "QuarkDSL Compiler - Unified compiler for GPU and Quantum backends")]
#[command(version)]
pub struct Args {
    #[command(subcommand)]
    pub command: Command,
}

#[derive(Subcommand)]
pub enum Command {
    /// Compile DSL source to target backend
    Compile {
        /// Input DSL file
        input: PathBuf,

        /// Target backend
        #[arg(short, long, value_enum)]
        target: Target,

        /// Output file (optional, defaults to stdout)
        #[arg(short, long)]
        output: Option<PathBuf>,

        /// Dump IR before code generation
        #[arg(long)]
        dump_ir: bool,

        /// Enable optimizations
        #[arg(short = 'O', long)]
        optimize: bool,
    },

    /// Parse and dump AST
    Parse {
        /// Input DSL file
        input: PathBuf,
    },

    /// Lower to IR and dump
    Lower {
        /// Input DSL file
        input: PathBuf,

        /// Enable optimizations
        #[arg(short = 'O', long)]
        optimize: bool,
    },
}

#[derive(Clone, Copy, ValueEnum)]
pub enum Target {
    /// WebGPU WGSL backend
    Wgsl,
    /// Quantum Qiskit backend
    Quantum,
    /// Python Orchestrator (Hybrid GPU + Quantum)
    Orchestrator,
}

pub fn run(args: Args) -> Result<()> {
    match args.command {
        Command::Compile {
            input,
            target,
            output,
            dump_ir,
            optimize,
        } => {
            let source = std::fs::read_to_string(&input)
                .with_context(|| format!("Failed to read input file: {:?}", input))?;

            // Frontend: Parse
            let ast = crate::frontend::parse(&source)
                .with_context(|| "Failed to parse source")?;

            // Frontend: Type check
            crate::frontend::typecheck(&ast)
                .with_context(|| "Type checking failed")?;

            // Middle-end: Lower to IR
            let mut ir = crate::middle::lower_to_ir(&ast)
                .with_context(|| "Failed to lower to IR")?;

            // Middle-end: Optimize
            if optimize {
                crate::middle::optimize(&mut ir);
            }

            // Dump IR if requested
            if dump_ir {
                eprintln!("=== IR ===");
                eprintln!("{}", crate::middle::dump_ir(&ir));
                eprintln!();
            }

            // Backend: Code generation
            let code = match target {
                Target::Wgsl => crate::backend::wgsl::codegen(&ir)?,
                Target::Quantum => crate::backend::quantum::codegen(&ir)?,
                Target::Orchestrator => crate::backend::orchestrator::generate_orchestrator(&ir)?,
            };

            // Output
            if let Some(output_path) = output {
                std::fs::write(&output_path, code)
                    .with_context(|| format!("Failed to write output: {:?}", output_path))?;
                println!("✓ Compiled to {:?}", output_path);
            } else {
                println!("{}", code);
            }

            Ok(())
        }

        Command::Parse { input } => {
            let source = std::fs::read_to_string(&input)
                .with_context(|| format!("Failed to read input file: {:?}", input))?;

            let ast = crate::frontend::parse(&source)
                .with_context(|| "Failed to parse source")?;

            println!("{:#?}", ast);
            Ok(())
        }

        Command::Lower { input, optimize } => {
            let source = std::fs::read_to_string(&input)
                .with_context(|| format!("Failed to read input file: {:?}", input))?;

            let ast = crate::frontend::parse(&source)
                .with_context(|| "Failed to parse source")?;

            crate::frontend::typecheck(&ast)
                .with_context(|| "Type checking failed")?;

            let mut ir = crate::middle::lower_to_ir(&ast)
                .with_context(|| "Failed to lower to IR")?;

            if optimize {
                crate::middle::optimize(&mut ir);
            }

            println!("{}", crate::middle::dump_ir(&ir));
            Ok(())
        }
    }
}

