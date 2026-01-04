/**
 * QuarkDSL Lexer - DFA-based tokenization
 * Converts source code into a stream of tokens
 */

export enum TokenType {
  // Keywords
  Fn = "Fn",
  Let = "Let",
  Return = "Return",
  If = "If",
  Else = "Else",
  For = "For",
  In = "In",
  Map = "Map",

  // Annotations
  GpuAnnotation = "GpuAnnotation",
  QuantumAnnotation = "QuantumAnnotation",

  // Types
  Int = "Int",
  Float = "Float",
  Bool = "Bool",
  Qubit = "Qubit",
  Void = "Void",
  Tensor = "Tensor",
  QState = "QState",

  // Literals
  True = "True",
  False = "False",
  IntLiteral = "IntLiteral",
  FloatLiteral = "FloatLiteral",
  Identifier = "Identifier",

  // Operators
  Plus = "Plus",
  Minus = "Minus",
  Star = "Star",
  Slash = "Slash",
  Percent = "Percent",
  EqEq = "EqEq",
  Ne = "Ne",
  Lt = "Lt",
  Le = "Le",
  Gt = "Gt",
  Ge = "Ge",
  AndAnd = "AndAnd",
  OrOr = "OrOr",
  Bang = "Bang",
  Eq = "Eq",

  // Delimiters
  LParen = "LParen",
  RParen = "RParen",
  LBrace = "LBrace",
  RBrace = "RBrace",
  LBracket = "LBracket",
  RBracket = "RBracket",
  Comma = "Comma",
  Semicolon = "Semicolon",
  Colon = "Colon",
  Arrow = "Arrow",
  DotDot = "DotDot",

  // Special
  EOF = "EOF",
}

export interface Token {
  type: TokenType;
  value?: string | number;
  line: number;
  column: number;
}

const KEYWORDS: Record<string, TokenType> = {
  fn: TokenType.Fn,
  let: TokenType.Let,
  return: TokenType.Return,
  if: TokenType.If,
  else: TokenType.Else,
  for: TokenType.For,
  in: TokenType.In,
  map: TokenType.Map,
  int: TokenType.Int,
  float: TokenType.Float,
  bool: TokenType.Bool,
  qubit: TokenType.Qubit,
  void: TokenType.Void,
  tensor: TokenType.Tensor,
  qstate: TokenType.QState,
  true: TokenType.True,
  false: TokenType.False,
};

export class Lexer {
  private source: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;

  constructor(source: string) {
    this.source = source;
  }

  private peek(offset: number = 0): string {
    return this.source[this.pos + offset] || "";
  }

  private advance(): string {
    const char = this.source[this.pos] || "";
    this.pos++;
    if (char === "\n") {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return char;
  }

  private skipWhitespace(): void {
    while (/\s/.test(this.peek())) {
      this.advance();
    }
  }

  private skipComment(): boolean {
    if (this.peek() === "/" && this.peek(1) === "/") {
      while (this.peek() && this.peek() !== "\n") {
        this.advance();
      }
      return true;
    }
    return false;
  }

  private skipWhitespaceAndComments(): void {
    while (true) {
      this.skipWhitespace();
      if (!this.skipComment()) {
        break;
      }
    }
  }

  private isAlpha(char: string): boolean {
    return /[a-zA-Z_]/.test(char);
  }

  private isAlphaNumeric(char: string): boolean {
    return /[a-zA-Z0-9_]/.test(char);
  }

  private isDigit(char: string): boolean {
    return /[0-9]/.test(char);
  }

  private makeToken(type: TokenType, value?: string | number): Token {
    return { type, value, line: this.line, column: this.column };
  }

  private readIdentifier(): Token {
    const startLine = this.line;
    const startCol = this.column;
    let value = "";

    while (this.isAlphaNumeric(this.peek())) {
      value += this.advance();
    }

    const type = KEYWORDS[value] || TokenType.Identifier;
    return {
      type,
      value: type === TokenType.Identifier ? value : undefined,
      line: startLine,
      column: startCol,
    };
  }

  private readNumber(): Token {
    const startLine = this.line;
    const startCol = this.column;
    let value = "";
    let isFloat = false;

    while (this.isDigit(this.peek())) {
      value += this.advance();
    }

    if (this.peek() === "." && this.isDigit(this.peek(1))) {
      isFloat = true;
      value += this.advance(); // consume '.'
      while (this.isDigit(this.peek())) {
        value += this.advance();
      }
    }

    return {
      type: isFloat ? TokenType.FloatLiteral : TokenType.IntLiteral,
      value: isFloat ? parseFloat(value) : parseInt(value, 10),
      line: startLine,
      column: startCol,
    };
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.pos < this.source.length) {
      this.skipWhitespaceAndComments();

      if (this.pos >= this.source.length) break;

      const char = this.peek();
      const startLine = this.line;
      const startCol = this.column;

      // Annotations
      if (char === "@") {
        this.advance();
        let annotation = "";
        while (this.isAlpha(this.peek())) {
          annotation += this.advance();
        }
        if (annotation === "gpu") {
          tokens.push({
            type: TokenType.GpuAnnotation,
            line: startLine,
            column: startCol,
          });
        } else if (annotation === "quantum") {
          tokens.push({
            type: TokenType.QuantumAnnotation,
            line: startLine,
            column: startCol,
          });
        }
        continue;
      }

      // Identifiers and keywords
      if (this.isAlpha(char)) {
        tokens.push(this.readIdentifier());
        continue;
      }

      // Numbers
      if (this.isDigit(char)) {
        tokens.push(this.readNumber());
        continue;
      }

      // Two-character operators
      if (char === "-" && this.peek(1) === ">") {
        this.advance();
        this.advance();
        tokens.push({
          type: TokenType.Arrow,
          line: startLine,
          column: startCol,
        });
        continue;
      }
      if (char === "." && this.peek(1) === ".") {
        this.advance();
        this.advance();
        tokens.push({
          type: TokenType.DotDot,
          line: startLine,
          column: startCol,
        });
        continue;
      }
      if (char === "=" && this.peek(1) === "=") {
        this.advance();
        this.advance();
        tokens.push({
          type: TokenType.EqEq,
          line: startLine,
          column: startCol,
        });
        continue;
      }
      if (char === "!" && this.peek(1) === "=") {
        this.advance();
        this.advance();
        tokens.push({ type: TokenType.Ne, line: startLine, column: startCol });
        continue;
      }
      if (char === "<" && this.peek(1) === "=") {
        this.advance();
        this.advance();
        tokens.push({ type: TokenType.Le, line: startLine, column: startCol });
        continue;
      }
      if (char === ">" && this.peek(1) === "=") {
        this.advance();
        this.advance();
        tokens.push({ type: TokenType.Ge, line: startLine, column: startCol });
        continue;
      }
      if (char === "&" && this.peek(1) === "&") {
        this.advance();
        this.advance();
        tokens.push({
          type: TokenType.AndAnd,
          line: startLine,
          column: startCol,
        });
        continue;
      }
      if (char === "|" && this.peek(1) === "|") {
        this.advance();
        this.advance();
        tokens.push({
          type: TokenType.OrOr,
          line: startLine,
          column: startCol,
        });
        continue;
      }

      // Single-character tokens
      this.advance();
      switch (char) {
        case "+":
          tokens.push({
            type: TokenType.Plus,
            line: startLine,
            column: startCol,
          });
          break;
        case "-":
          tokens.push({
            type: TokenType.Minus,
            line: startLine,
            column: startCol,
          });
          break;
        case "*":
          tokens.push({
            type: TokenType.Star,
            line: startLine,
            column: startCol,
          });
          break;
        case "/":
          tokens.push({
            type: TokenType.Slash,
            line: startLine,
            column: startCol,
          });
          break;
        case "%":
          tokens.push({
            type: TokenType.Percent,
            line: startLine,
            column: startCol,
          });
          break;
        case "<":
          tokens.push({
            type: TokenType.Lt,
            line: startLine,
            column: startCol,
          });
          break;
        case ">":
          tokens.push({
            type: TokenType.Gt,
            line: startLine,
            column: startCol,
          });
          break;
        case "!":
          tokens.push({
            type: TokenType.Bang,
            line: startLine,
            column: startCol,
          });
          break;
        case "=":
          tokens.push({
            type: TokenType.Eq,
            line: startLine,
            column: startCol,
          });
          break;
        case "(":
          tokens.push({
            type: TokenType.LParen,
            line: startLine,
            column: startCol,
          });
          break;
        case ")":
          tokens.push({
            type: TokenType.RParen,
            line: startLine,
            column: startCol,
          });
          break;
        case "{":
          tokens.push({
            type: TokenType.LBrace,
            line: startLine,
            column: startCol,
          });
          break;
        case "}":
          tokens.push({
            type: TokenType.RBrace,
            line: startLine,
            column: startCol,
          });
          break;
        case "[":
          tokens.push({
            type: TokenType.LBracket,
            line: startLine,
            column: startCol,
          });
          break;
        case "]":
          tokens.push({
            type: TokenType.RBracket,
            line: startLine,
            column: startCol,
          });
          break;
        case ",":
          tokens.push({
            type: TokenType.Comma,
            line: startLine,
            column: startCol,
          });
          break;
        case ";":
          tokens.push({
            type: TokenType.Semicolon,
            line: startLine,
            column: startCol,
          });
          break;
        case ":":
          tokens.push({
            type: TokenType.Colon,
            line: startLine,
            column: startCol,
          });
          break;
        default:
          throw new Error(
            `Unexpected character '${char}' at line ${startLine}, column ${startCol}`
          );
      }
    }

    tokens.push({ type: TokenType.EOF, line: this.line, column: this.column });
    return tokens;
  }
}
