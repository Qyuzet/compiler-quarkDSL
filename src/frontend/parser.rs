use super::ast::*;
use super::lexer::Token;
use anyhow::{anyhow, bail, Result};
use logos::Logos;

// Syntax Analysis: Recursive Descent Parser (RDP)
// Top-Down Parsing: Start from root (Program) and expand to leaves
// LL(1) Grammar: Left-to-right scan, Leftmost derivation, 1 lookahead token
// Each grammar production rule is implemented as a recursive function

pub struct Parser {
    tokens: Vec<Token>,  // Token stream from lexer
    pos: usize,          // Current position (lookahead pointer)
}

impl Parser {
    fn new(tokens: Vec<Token>) -> Self {
        Self { tokens, pos: 0 }
    }

    // Lookahead: Peek at current token without consuming
    fn current(&self) -> Option<&Token> {
        self.tokens.get(self.pos)
    }

    // Consume current token and advance position
    fn advance(&mut self) -> Option<Token> {
        let token = self.tokens.get(self.pos).cloned();
        self.pos += 1;
        token
    }

    // Predictive Parsing: Expect specific token based on grammar
    fn expect(&mut self, expected: Token) -> Result<()> {
        let current = self.current().ok_or_else(|| anyhow!("Unexpected EOF"))?;
        if std::mem::discriminant(current) != std::mem::discriminant(&expected) {
            bail!("Expected {:?}, found {:?}", expected, current);
        }
        self.advance();
        Ok(())
    }

    // Grammar Rule: Program → Function*
    // Top-Down Parsing: Start from root production
    fn parse_program(&mut self) -> Result<Program> {
        let mut functions = Vec::new();
        while self.current().is_some() {
            functions.push(self.parse_function()?);  // Recursive call
        }
        Ok(Program { functions })
    }

    // Grammar Rule: Function → Domain? "fn" Identifier "(" Parameters ")" "->" Type Block
    // Recursive Descent: Each grammar rule is a function
    fn parse_function(&mut self) -> Result<Function> {
        // Parse optional domain annotation (Domain?)
        // First Set: {@gpu, @quantum, fn}
        let domain = match self.current() {
            Some(Token::GpuAnnotation) => {
                self.advance();
                Domain::Gpu
            }
            Some(Token::QuantumAnnotation) => {
                self.advance();
                Domain::Quantum
            }
            _ => Domain::Classical,
        };

        self.expect(Token::Fn)?;

        let name = match self.advance() {
            Some(Token::Identifier(s)) => s,
            _ => bail!("Expected function name"),
        };

        self.expect(Token::LParen)?;
        let params = self.parse_params()?;
        self.expect(Token::RParen)?;

        self.expect(Token::Arrow)?;
        let return_type = self.parse_type()?;

        self.expect(Token::LBrace)?;
        let body = self.parse_statements()?;
        self.expect(Token::RBrace)?;

        Ok(Function {
            name,
            params,
            return_type,
            body,
            domain,  // NEW: include domain
        })
    }

    fn parse_params(&mut self) -> Result<Vec<Param>> {
        let mut params = Vec::new();

        if matches!(self.current(), Some(Token::RParen)) {
            return Ok(params);
        }

        loop {
            let name = match self.advance() {
                Some(Token::Identifier(s)) => s,
                _ => bail!("Expected parameter name"),
            };

            self.expect(Token::Colon)?;
            let ty = self.parse_type()?;

            params.push(Param { name, ty });

            if !matches!(self.current(), Some(Token::Comma)) {
                break;
            }
            self.advance();
        }

        Ok(params)
    }

    fn parse_type(&mut self) -> Result<Type> {
        match self.advance() {
            Some(Token::Int) => Ok(Type::Int),
            Some(Token::Float) => Ok(Type::Float),
            Some(Token::Bool) => Ok(Type::Bool),
            Some(Token::Qubit) => Ok(Type::Qubit),
            Some(Token::Void) => Ok(Type::Void),
            Some(Token::QState) => Ok(Type::QState),  // NEW: qstate type
            Some(Token::Tensor) => {
                // NEW: tensor<T> type
                self.expect(Token::Lt)?;
                let elem_type = self.parse_type()?;
                self.expect(Token::Gt)?;
                Ok(Type::Tensor(Box::new(elem_type)))
            }
            Some(Token::LBracket) => {
                let elem_type = self.parse_type()?;
                let size = if matches!(self.current(), Some(Token::Semicolon)) {
                    self.advance();
                    match self.advance() {
                        Some(Token::IntLiteral(n)) => Some(n as usize),
                        _ => bail!("Expected array size"),
                    }
                } else {
                    None
                };
                self.expect(Token::RBracket)?;
                Ok(Type::Array(Box::new(elem_type), size))
            }
            _ => bail!("Expected type"),
        }
    }

    fn parse_statements(&mut self) -> Result<Vec<Statement>> {
        let mut statements = Vec::new();

        while !matches!(self.current(), Some(Token::RBrace) | None) {
            statements.push(self.parse_statement()?);
        }

        Ok(statements)
    }

    fn parse_statement(&mut self) -> Result<Statement> {
        match self.current() {
            Some(Token::Let) => self.parse_let(),
            Some(Token::Return) => self.parse_return(),
            Some(Token::For) => self.parse_for(),
            Some(Token::If) => self.parse_if(),
            Some(Token::Identifier(_)) => {
                // Could be assignment or expression statement
                let checkpoint = self.pos;
                if let Ok(name) = self.try_parse_identifier() {
                    if matches!(self.current(), Some(Token::Eq | Token::LBracket)) {
                        return self.parse_assignment(name);
                    }
                }
                self.pos = checkpoint;
                let expr = self.parse_expression()?;
                self.expect(Token::Semicolon)?;
                Ok(Statement::Expression(expr))
            }
            _ => {
                let expr = self.parse_expression()?;
                self.expect(Token::Semicolon)?;
                Ok(Statement::Expression(expr))
            }
        }
    }

    fn try_parse_identifier(&mut self) -> Result<String> {
        match self.advance() {
            Some(Token::Identifier(s)) => Ok(s),
            _ => bail!("Expected identifier"),
        }
    }

    fn parse_let(&mut self) -> Result<Statement> {
        self.expect(Token::Let)?;
        let name = self.try_parse_identifier()?;

        let ty = if matches!(self.current(), Some(Token::Colon)) {
            self.advance();
            Some(self.parse_type()?)
        } else {
            None
        };

        self.expect(Token::Eq)?;
        let value = self.parse_expression()?;
        self.expect(Token::Semicolon)?;

        Ok(Statement::Let { name, ty, value })
    }

    fn parse_assignment(&mut self, name: String) -> Result<Statement> {
        let index = if matches!(self.current(), Some(Token::LBracket)) {
            self.advance();
            let idx = self.parse_expression()?;
            self.expect(Token::RBracket)?;
            Some(Box::new(idx))
        } else {
            None
        };

        self.expect(Token::Eq)?;
        let value = self.parse_expression()?;
        self.expect(Token::Semicolon)?;

        Ok(Statement::Assign {
            target: name,
            index,
            value,
        })
    }

    fn parse_return(&mut self) -> Result<Statement> {
        self.expect(Token::Return)?;

        // Check if this is a void return (return;)
        if matches!(self.current(), Some(Token::Semicolon)) {
            self.advance();
            // Return a unit/void value - we'll use IntLiteral(0) as placeholder
            return Ok(Statement::Return(Expression::IntLiteral(0)));
        }

        let expr = self.parse_expression()?;
        self.expect(Token::Semicolon)?;
        Ok(Statement::Return(expr))
    }

    fn parse_for(&mut self) -> Result<Statement> {
        self.expect(Token::For)?;
        let var = self.try_parse_identifier()?;
        self.expect(Token::In)?;
        let start = self.parse_expression()?;
        self.expect(Token::DotDot)?;
        let end = self.parse_expression()?;
        self.expect(Token::LBrace)?;
        let body = self.parse_statements()?;
        self.expect(Token::RBrace)?;

        Ok(Statement::For {
            var,
            start,
            end,
            body,
        })
    }

    fn parse_if(&mut self) -> Result<Statement> {
        self.expect(Token::If)?;
        let condition = self.parse_expression()?;
        self.expect(Token::LBrace)?;
        let then_body = self.parse_statements()?;
        self.expect(Token::RBrace)?;

        let else_body = if matches!(self.current(), Some(Token::Else)) {
            self.advance();
            self.expect(Token::LBrace)?;
            let body = self.parse_statements()?;
            self.expect(Token::RBrace)?;
            Some(body)
        } else {
            None
        };

        Ok(Statement::If {
            condition,
            then_body,
            else_body,
        })
    }

    // Grammar Rule: Expression → LogicalOr
    // Precedence Climbing: Parse expressions by precedence levels
    fn parse_expression(&mut self) -> Result<Expression> {
        self.parse_or()
    }

    // Grammar Rule: LogicalOr → LogicalAnd ("||" LogicalAnd)*
    // Left Recursion Elimination: Transformed to iteration
    // Original (left-recursive): LogicalOr → LogicalOr "||" LogicalAnd
    // Transformed: LogicalOr → LogicalAnd ("||" LogicalAnd)*
    fn parse_or(&mut self) -> Result<Expression> {
        let mut left = self.parse_and()?;

        // Iteration instead of left recursion
        while matches!(self.current(), Some(Token::OrOr)) {
            self.advance();
            let right = self.parse_and()?;
            left = Expression::Binary {
                op: BinaryOp::Or,
                left: Box::new(left),
                right: Box::new(right),
            };
        }

        Ok(left)
    }

    fn parse_and(&mut self) -> Result<Expression> {
        let mut left = self.parse_equality()?;

        while matches!(self.current(), Some(Token::AndAnd)) {
            self.advance();
            let right = self.parse_equality()?;
            left = Expression::Binary {
                op: BinaryOp::And,
                left: Box::new(left),
                right: Box::new(right),
            };
        }

        Ok(left)
    }

    fn parse_equality(&mut self) -> Result<Expression> {
        let mut left = self.parse_comparison()?;

        while let Some(op) = self.current() {
            let binary_op = match op {
                Token::EqEq => BinaryOp::Eq,
                Token::Ne => BinaryOp::Ne,
                _ => break,
            };
            self.advance();
            let right = self.parse_comparison()?;
            left = Expression::Binary {
                op: binary_op,
                left: Box::new(left),
                right: Box::new(right),
            };
        }

        Ok(left)
    }

    fn parse_comparison(&mut self) -> Result<Expression> {
        let mut left = self.parse_term()?;

        while let Some(op) = self.current() {
            let binary_op = match op {
                Token::Lt => BinaryOp::Lt,
                Token::Le => BinaryOp::Le,
                Token::Gt => BinaryOp::Gt,
                Token::Ge => BinaryOp::Ge,
                _ => break,
            };
            self.advance();
            let right = self.parse_term()?;
            left = Expression::Binary {
                op: binary_op,
                left: Box::new(left),
                right: Box::new(right),
            };
        }

        Ok(left)
    }

    fn parse_term(&mut self) -> Result<Expression> {
        let mut left = self.parse_factor()?;

        while let Some(op) = self.current() {
            let binary_op = match op {
                Token::Plus => BinaryOp::Add,
                Token::Minus => BinaryOp::Sub,
                _ => break,
            };
            self.advance();
            let right = self.parse_factor()?;
            left = Expression::Binary {
                op: binary_op,
                left: Box::new(left),
                right: Box::new(right),
            };
        }

        Ok(left)
    }

    fn parse_factor(&mut self) -> Result<Expression> {
        let mut left = self.parse_unary()?;

        while let Some(op) = self.current() {
            let binary_op = match op {
                Token::Star => BinaryOp::Mul,
                Token::Slash => BinaryOp::Div,
                Token::Percent => BinaryOp::Mod,
                _ => break,
            };
            self.advance();
            let right = self.parse_unary()?;
            left = Expression::Binary {
                op: binary_op,
                left: Box::new(left),
                right: Box::new(right),
            };
        }

        Ok(left)
    }

    fn parse_unary(&mut self) -> Result<Expression> {
        match self.current() {
            Some(Token::Minus) => {
                self.advance();
                let operand = self.parse_unary()?;
                Ok(Expression::Unary {
                    op: UnaryOp::Neg,
                    operand: Box::new(operand),
                })
            }
            Some(Token::Bang) => {
                self.advance();
                let operand = self.parse_unary()?;
                Ok(Expression::Unary {
                    op: UnaryOp::Not,
                    operand: Box::new(operand),
                })
            }
            _ => self.parse_postfix(),
        }
    }

    fn parse_postfix(&mut self) -> Result<Expression> {
        let mut expr = self.parse_primary()?;

        loop {
            match self.current() {
                Some(Token::LBracket) => {
                    self.advance();
                    let index = self.parse_expression()?;
                    self.expect(Token::RBracket)?;
                    expr = Expression::Index {
                        array: Box::new(expr),
                        index: Box::new(index),
                    };
                }
                Some(Token::LParen) => {
                    // Function call
                    if let Expression::Variable(name) = expr {
                        self.advance();
                        let args = self.parse_args()?;
                        self.expect(Token::RParen)?;
                        expr = Expression::Call {
                            function: name,
                            args,
                        };
                    } else {
                        break;
                    }
                }
                _ => break,
            }
        }

        Ok(expr)
    }

    fn parse_primary(&mut self) -> Result<Expression> {
        match self.advance() {
            Some(Token::IntLiteral(n)) => Ok(Expression::IntLiteral(n)),
            Some(Token::FloatLiteral(f)) => Ok(Expression::FloatLiteral(f)),
            Some(Token::True) => Ok(Expression::BoolLiteral(true)),
            Some(Token::False) => Ok(Expression::BoolLiteral(false)),
            Some(Token::Identifier(name)) => Ok(Expression::Variable(name)),
            Some(Token::LBracket) => {
                let elements = self.parse_array_elements()?;
                self.expect(Token::RBracket)?;
                Ok(Expression::ArrayLiteral(elements))
            }
            Some(Token::LParen) => {
                let expr = self.parse_expression()?;
                self.expect(Token::RParen)?;
                Ok(expr)
            }
            Some(Token::Map) => {
                self.expect(Token::LParen)?;
                let function = self.try_parse_identifier()?;
                self.expect(Token::Comma)?;
                let array = self.parse_expression()?;
                self.expect(Token::RParen)?;
                Ok(Expression::Map {
                    function,
                    array: Box::new(array),
                })
            }
            _ => bail!("Unexpected token in expression"),
        }
    }

    fn parse_args(&mut self) -> Result<Vec<Expression>> {
        let mut args = Vec::new();

        if matches!(self.current(), Some(Token::RParen)) {
            return Ok(args);
        }

        loop {
            args.push(self.parse_expression()?);
            if !matches!(self.current(), Some(Token::Comma)) {
                break;
            }
            self.advance();
        }

        Ok(args)
    }

    fn parse_array_elements(&mut self) -> Result<Vec<Expression>> {
        let mut elements = Vec::new();

        if matches!(self.current(), Some(Token::RBracket)) {
            return Ok(elements);
        }

        loop {
            elements.push(self.parse_expression()?);
            if !matches!(self.current(), Some(Token::Comma)) {
                break;
            }
            self.advance();
        }

        Ok(elements)
    }
}

pub fn parse(source: &str) -> Result<Program> {
    let tokens: Vec<Token> = Token::lexer(source)
        .filter_map(|result| result.ok())
        .collect();

    let mut parser = Parser::new(tokens);
    parser.parse_program()
}



