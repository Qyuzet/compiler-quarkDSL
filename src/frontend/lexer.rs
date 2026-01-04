use logos::Logos;

// Lexical Analysis: DFA-based tokenization using Logos library
// Logos automatically generates DFA from regex patterns (Regex to DFA conversion)
// Thompson's Construction: Regex → ε-NFA → NFA → DFA (done internally by Logos)
// DFA Minimization: Logos optimizes the generated DFA

#[derive(Logos, Debug, Clone, PartialEq)]
#[logos(skip r"[ \t\n\f]+")]      // Skip whitespace (regex pattern)
#[logos(skip r"//[^\n]*")]        // Skip single-line comments (regex pattern)
pub enum Token {
    // Keywords (exact string matching in DFA)
    #[token("fn")]
    Fn,
    #[token("let")]
    Let,
    #[token("return")]
    Return,
    #[token("if")]
    If,
    #[token("else")]
    Else,
    #[token("for")]
    For,
    #[token("in")]
    In,
    #[token("map")]
    Map,

    // Annotations (domain-specific keywords)
    #[token("@gpu")]
    GpuAnnotation,
    #[token("@quantum")]
    QuantumAnnotation,

    // Types (keywords for type system)
    #[token("int")]
    Int,
    #[token("float")]
    Float,
    #[token("bool")]
    Bool,
    #[token("qubit")]
    Qubit,
    #[token("void")]
    Void,
    #[token("tensor")]
    Tensor,
    #[token("qstate")]
    QState,

    // Literals (constant values)
    #[token("true")]
    True,
    #[token("false")]
    False,

    // Regex to DFA: Integer literal pattern
    #[regex(r"[0-9]+", |lex| lex.slice().parse().ok())]
    IntLiteral(i64),

    // Regex to DFA: Float literal pattern (digits.digits)
    #[regex(r"[0-9]+\.[0-9]+", |lex| lex.slice().parse().ok())]
    FloatLiteral(f64),

    // Regex to DFA: Identifier pattern (letter/underscore followed by alphanumeric)
    // Maximal Munch: Longest match principle
    #[regex(r"[a-zA-Z_][a-zA-Z0-9_]*", |lex| lex.slice().to_string())]
    Identifier(String),

    // Operators
    #[token("+")]
    Plus,
    #[token("-")]
    Minus,
    #[token("*")]
    Star,
    #[token("/")]
    Slash,
    #[token("%")]
    Percent,

    #[token("==")]
    EqEq,
    #[token("!=")]
    Ne,
    #[token("<")]
    Lt,
    #[token("<=")]
    Le,
    #[token(">")]
    Gt,
    #[token(">=")]
    Ge,

    #[token("&&")]
    AndAnd,
    #[token("||")]
    OrOr,
    #[token("!")]
    Bang,

    #[token("=")]
    Eq,

    // Delimiters
    #[token("(")]
    LParen,
    #[token(")")]
    RParen,
    #[token("{")]
    LBrace,
    #[token("}")]
    RBrace,
    #[token("[")]
    LBracket,
    #[token("]")]
    RBracket,

    #[token(",")]
    Comma,
    #[token(";")]
    Semicolon,
    #[token(":")]
    Colon,
    #[token("->")]
    Arrow,
    #[token("..")]
    DotDot,
}

impl std::fmt::Display for Token {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Token::Fn => write!(f, "fn"),
            Token::Let => write!(f, "let"),
            Token::Return => write!(f, "return"),
            Token::If => write!(f, "if"),
            Token::Else => write!(f, "else"),
            Token::For => write!(f, "for"),
            Token::In => write!(f, "in"),
            Token::Map => write!(f, "map"),
            Token::GpuAnnotation => write!(f, "@gpu"),
            Token::QuantumAnnotation => write!(f, "@quantum"),
            Token::Int => write!(f, "int"),
            Token::Float => write!(f, "float"),
            Token::Bool => write!(f, "bool"),
            Token::Qubit => write!(f, "qubit"),
            Token::Void => write!(f, "void"),
            Token::Tensor => write!(f, "tensor"),
            Token::QState => write!(f, "qstate"),
            Token::True => write!(f, "true"),
            Token::False => write!(f, "false"),
            Token::IntLiteral(n) => write!(f, "{}", n),
            Token::FloatLiteral(n) => write!(f, "{}", n),
            Token::Identifier(s) => write!(f, "{}", s),
            Token::Plus => write!(f, "+"),
            Token::Minus => write!(f, "-"),
            Token::Star => write!(f, "*"),
            Token::Slash => write!(f, "/"),
            Token::Percent => write!(f, "%"),
            Token::EqEq => write!(f, "=="),
            Token::Ne => write!(f, "!="),
            Token::Lt => write!(f, "<"),
            Token::Le => write!(f, "<="),
            Token::Gt => write!(f, ">"),
            Token::Ge => write!(f, ">="),
            Token::AndAnd => write!(f, "&&"),
            Token::OrOr => write!(f, "||"),
            Token::Bang => write!(f, "!"),
            Token::Eq => write!(f, "="),
            Token::LParen => write!(f, "("),
            Token::RParen => write!(f, ")"),
            Token::LBrace => write!(f, "{{"),
            Token::RBrace => write!(f, "}}"),
            Token::LBracket => write!(f, "["),
            Token::RBracket => write!(f, "]"),
            Token::Comma => write!(f, ","),
            Token::Semicolon => write!(f, ";"),
            Token::Colon => write!(f, ":"),
            Token::Arrow => write!(f, "->"),
            Token::DotDot => write!(f, ".."),
        }
    }
}

