/**
 * QuarkDSL Parser - Recursive Descent Parser
 * Converts token stream into AST
 */

import { Token, TokenType } from "./lexer";
import {
  Program,
  Function,
  Statement,
  Expression,
  Type,
  TypeKind,
  Param,
  Domain,
  BinaryOp,
  UnaryOp,
} from "./ast";

export class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private current(): Token {
    return this.tokens[this.pos] || { type: TokenType.EOF, line: 0, column: 0 };
  }

  private advance(): Token {
    const token = this.current();
    this.pos++;
    return token;
  }

  private expect(type: TokenType): Token {
    const token = this.current();
    if (token.type !== type) {
      throw new Error(
        `Expected ${type}, found ${token.type} at line ${token.line}, column ${token.column}`
      );
    }
    return this.advance();
  }

  private match(type: TokenType): boolean {
    return this.current().type === type;
  }

  parse(): Program {
    const functions: Function[] = [];
    while (!this.match(TokenType.EOF)) {
      functions.push(this.parseFunction());
    }
    return { functions };
  }

  private parseFunction(): Function {
    let domain = Domain.Classical;
    if (this.match(TokenType.GpuAnnotation)) {
      this.advance();
      domain = Domain.Gpu;
    } else if (this.match(TokenType.QuantumAnnotation)) {
      this.advance();
      domain = Domain.Quantum;
    }

    this.expect(TokenType.Fn);
    const nameToken = this.expect(TokenType.Identifier);
    const name = nameToken.value as string;

    this.expect(TokenType.LParen);
    const params = this.parseParams();
    this.expect(TokenType.RParen);

    this.expect(TokenType.Arrow);
    const returnType = this.parseType();

    this.expect(TokenType.LBrace);
    const body = this.parseStatements();
    this.expect(TokenType.RBrace);

    return { name, params, returnType, body, domain };
  }

  private parseParams(): Param[] {
    const params: Param[] = [];
    if (this.match(TokenType.RParen)) return params;

    do {
      if (this.match(TokenType.Comma)) this.advance();
      const nameToken = this.expect(TokenType.Identifier);
      this.expect(TokenType.Colon);
      const ty = this.parseType();
      params.push({ name: nameToken.value as string, ty });
    } while (this.match(TokenType.Comma));

    return params;
  }

  private parseType(): Type {
    const token = this.advance();
    switch (token.type) {
      case TokenType.Int:
        return { kind: TypeKind.Int };
      case TokenType.Float:
        return { kind: TypeKind.Float };
      case TokenType.Bool:
        return { kind: TypeKind.Bool };
      case TokenType.Qubit:
        return { kind: TypeKind.Qubit };
      case TokenType.Void:
        return { kind: TypeKind.Void };
      case TokenType.QState:
        return { kind: TypeKind.QState };
      case TokenType.Tensor:
        this.expect(TokenType.Lt);
        const elemType = this.parseType();
        this.expect(TokenType.Gt);
        return { kind: TypeKind.Tensor, elementType: elemType };
      case TokenType.LBracket:
        const arrayElemType = this.parseType();
        let size: number | undefined;
        if (this.match(TokenType.Semicolon)) {
          this.advance();
          const sizeToken = this.expect(TokenType.IntLiteral);
          size = sizeToken.value as number;
        }
        this.expect(TokenType.RBracket);
        return { kind: TypeKind.Array, elementType: arrayElemType, size };
      default:
        throw new Error(`Expected type, found ${token.type}`);
    }
  }

  private parseStatements(): Statement[] {
    const statements: Statement[] = [];
    while (!this.match(TokenType.RBrace) && !this.match(TokenType.EOF)) {
      statements.push(this.parseStatement());
    }
    return statements;
  }

  private parseStatement(): Statement {
    if (this.match(TokenType.Let)) {
      return this.parseLet();
    }
    if (this.match(TokenType.Return)) {
      return this.parseReturn();
    }
    if (this.match(TokenType.For)) {
      return this.parseFor();
    }
    if (this.match(TokenType.If)) {
      return this.parseIf();
    }
    if (this.match(TokenType.Identifier)) {
      const checkpoint = this.pos;
      const nameToken = this.advance();
      if (this.match(TokenType.Eq) || this.match(TokenType.LBracket)) {
        return this.parseAssignment(nameToken.value as string);
      }
      this.pos = checkpoint;
    }
    const expr = this.parseExpression();
    this.expect(TokenType.Semicolon);
    return { kind: "Expression", expr };
  }

  private parseLet(): Statement {
    this.expect(TokenType.Let);
    const nameToken = this.expect(TokenType.Identifier);
    let ty: Type | undefined;
    if (this.match(TokenType.Colon)) {
      this.advance();
      ty = this.parseType();
    }
    this.expect(TokenType.Eq);
    const value = this.parseExpression();
    this.expect(TokenType.Semicolon);
    return { kind: "Let", name: nameToken.value as string, ty, value };
  }

  private parseAssignment(name: string): Statement {
    let index: Expression | undefined;
    if (this.match(TokenType.LBracket)) {
      this.advance();
      index = this.parseExpression();
      this.expect(TokenType.RBracket);
    }
    this.expect(TokenType.Eq);
    const value = this.parseExpression();
    this.expect(TokenType.Semicolon);
    return { kind: "Assign", target: name, index, value };
  }

  private parseReturn(): Statement {
    this.expect(TokenType.Return);
    if (this.match(TokenType.Semicolon)) {
      this.advance();
      return { kind: "Return", value: { kind: "IntLiteral", value: 0 } };
    }
    const value = this.parseExpression();
    this.expect(TokenType.Semicolon);
    return { kind: "Return", value };
  }

  private parseFor(): Statement {
    this.expect(TokenType.For);
    const varToken = this.expect(TokenType.Identifier);
    this.expect(TokenType.In);
    const start = this.parseExpression();
    this.expect(TokenType.DotDot);
    const end = this.parseExpression();
    this.expect(TokenType.LBrace);
    const body = this.parseStatements();
    this.expect(TokenType.RBrace);
    return { kind: "For", var: varToken.value as string, start, end, body };
  }

  private parseIf(): Statement {
    this.expect(TokenType.If);
    const condition = this.parseExpression();
    this.expect(TokenType.LBrace);
    const thenBody = this.parseStatements();
    this.expect(TokenType.RBrace);
    let elseBody: Statement[] | undefined;
    if (this.match(TokenType.Else)) {
      this.advance();
      this.expect(TokenType.LBrace);
      elseBody = this.parseStatements();
      this.expect(TokenType.RBrace);
    }
    return { kind: "If", condition, thenBody, elseBody };
  }

  // Expression parsing with precedence climbing
  private parseExpression(): Expression {
    return this.parseOr();
  }

  private parseOr(): Expression {
    let left = this.parseAnd();
    while (this.match(TokenType.OrOr)) {
      this.advance();
      const right = this.parseAnd();
      left = { kind: "Binary", op: BinaryOp.Or, left, right };
    }
    return left;
  }

  private parseAnd(): Expression {
    let left = this.parseEquality();
    while (this.match(TokenType.AndAnd)) {
      this.advance();
      const right = this.parseEquality();
      left = { kind: "Binary", op: BinaryOp.And, left, right };
    }
    return left;
  }

  private parseEquality(): Expression {
    let left = this.parseComparison();
    while (this.match(TokenType.EqEq) || this.match(TokenType.Ne)) {
      const op =
        this.advance().type === TokenType.EqEq ? BinaryOp.Eq : BinaryOp.Ne;
      const right = this.parseComparison();
      left = { kind: "Binary", op, left, right };
    }
    return left;
  }

  private parseComparison(): Expression {
    let left = this.parseTerm();
    while (
      this.match(TokenType.Lt) ||
      this.match(TokenType.Le) ||
      this.match(TokenType.Gt) ||
      this.match(TokenType.Ge)
    ) {
      const token = this.advance();
      const op =
        token.type === TokenType.Lt
          ? BinaryOp.Lt
          : token.type === TokenType.Le
          ? BinaryOp.Le
          : token.type === TokenType.Gt
          ? BinaryOp.Gt
          : BinaryOp.Ge;
      const right = this.parseTerm();
      left = { kind: "Binary", op, left, right };
    }
    return left;
  }

  private parseTerm(): Expression {
    let left = this.parseFactor();
    while (this.match(TokenType.Plus) || this.match(TokenType.Minus)) {
      const op =
        this.advance().type === TokenType.Plus ? BinaryOp.Add : BinaryOp.Sub;
      const right = this.parseFactor();
      left = { kind: "Binary", op, left, right };
    }
    return left;
  }

  private parseFactor(): Expression {
    let left = this.parseUnary();
    while (
      this.match(TokenType.Star) ||
      this.match(TokenType.Slash) ||
      this.match(TokenType.Percent)
    ) {
      const token = this.advance();
      const op =
        token.type === TokenType.Star
          ? BinaryOp.Mul
          : token.type === TokenType.Slash
          ? BinaryOp.Div
          : BinaryOp.Mod;
      const right = this.parseUnary();
      left = { kind: "Binary", op, left, right };
    }
    return left;
  }

  private parseUnary(): Expression {
    if (this.match(TokenType.Minus)) {
      this.advance();
      const operand = this.parseUnary();
      return { kind: "Unary", op: UnaryOp.Neg, operand };
    }
    if (this.match(TokenType.Bang)) {
      this.advance();
      const operand = this.parseUnary();
      return { kind: "Unary", op: UnaryOp.Not, operand };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expression {
    let expr = this.parsePrimary();
    while (true) {
      if (this.match(TokenType.LBracket)) {
        this.advance();
        const index = this.parseExpression();
        this.expect(TokenType.RBracket);
        expr = { kind: "Index", array: expr, index };
      } else if (this.match(TokenType.LParen) && expr.kind === "Variable") {
        this.advance();
        const args = this.parseArgs();
        this.expect(TokenType.RParen);
        expr = { kind: "Call", function: expr.name, args };
      } else {
        break;
      }
    }
    return expr;
  }

  private parsePrimary(): Expression {
    const token = this.advance();
    switch (token.type) {
      case TokenType.IntLiteral:
        return { kind: "IntLiteral", value: token.value as number };
      case TokenType.FloatLiteral:
        return { kind: "FloatLiteral", value: token.value as number };
      case TokenType.True:
        return { kind: "BoolLiteral", value: true };
      case TokenType.False:
        return { kind: "BoolLiteral", value: false };
      case TokenType.Identifier:
        return { kind: "Variable", name: token.value as string };
      case TokenType.LBracket:
        const elements = this.parseArrayElements();
        this.expect(TokenType.RBracket);
        return { kind: "ArrayLiteral", elements };
      case TokenType.LParen:
        const expr = this.parseExpression();
        this.expect(TokenType.RParen);
        return expr;
      case TokenType.Map:
        this.expect(TokenType.LParen);
        const funcToken = this.expect(TokenType.Identifier);
        this.expect(TokenType.Comma);
        const array = this.parseExpression();
        this.expect(TokenType.RParen);
        return { kind: "Map", function: funcToken.value as string, array };
      default:
        throw new Error(`Unexpected token ${token.type} in expression`);
    }
  }

  private parseArgs(): Expression[] {
    const args: Expression[] = [];
    if (this.match(TokenType.RParen)) return args;
    do {
      if (this.match(TokenType.Comma)) this.advance();
      args.push(this.parseExpression());
    } while (this.match(TokenType.Comma));
    return args;
  }

  private parseArrayElements(): Expression[] {
    const elements: Expression[] = [];
    if (this.match(TokenType.RBracket)) return elements;
    do {
      if (this.match(TokenType.Comma)) this.advance();
      elements.push(this.parseExpression());
    } while (this.match(TokenType.Comma));
    return elements;
  }
}
