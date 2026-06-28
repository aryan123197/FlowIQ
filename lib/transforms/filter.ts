export interface FilterConfig {
  expression: string // e.g. "amount > 1000 AND status == 'completed'"
}

type TokenType = 'IDENT' | 'NUMBER' | 'STRING' | 'OP' | 'AND' | 'OR' | 'LPAREN' | 'RPAREN'
interface Token {
  type: TokenType
  value: string
}

const OPERATORS = ['>=', '<=', '==', '!=', '>', '<']

function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < expr.length) {
    const ch = expr[i]

    if (/\s/.test(ch)) {
      i++
      continue
    }

    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: ch })
      i++
      continue
    }

    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ch })
      i++
      continue
    }

    if (ch === "'" || ch === '"') {
      const quote = ch
      let j = i + 1
      let value = ''
      while (j < expr.length && expr[j] !== quote) {
        value += expr[j]
        j++
      }
      if (j >= expr.length) throw new Error(`Unterminated string literal in filter expression: ${expr}`)
      tokens.push({ type: 'STRING', value })
      i = j + 1
      continue
    }

    const opMatch = OPERATORS.find((op) => expr.startsWith(op, i))
    if (opMatch) {
      tokens.push({ type: 'OP', value: opMatch })
      i += opMatch.length
      continue
    }

    if (/[0-9]/.test(ch) || (ch === '-' && /[0-9]/.test(expr[i + 1] ?? ''))) {
      let j = i + 1
      while (j < expr.length && /[0-9.]/.test(expr[j])) j++
      tokens.push({ type: 'NUMBER', value: expr.slice(i, j) })
      i = j
      continue
    }

    if (/[a-zA-Z_]/.test(ch)) {
      let j = i + 1
      while (j < expr.length && /[a-zA-Z0-9_]/.test(expr[j])) j++
      const word = expr.slice(i, j)
      const upper = word.toUpperCase()
      if (upper === 'AND') tokens.push({ type: 'AND', value: upper })
      else if (upper === 'OR') tokens.push({ type: 'OR', value: upper })
      else tokens.push({ type: 'IDENT', value: word })
      i = j
      continue
    }

    throw new Error(`Unexpected character "${ch}" in filter expression: ${expr}`)
  }

  return tokens
}

interface Comparison {
  field: string
  op: string
  literal: string | number
}

type Clause = Comparison | { and: Clause[] } | { or: Clause[] }

function parseComparison(tokens: Token[], pos: number): [Comparison, number] {
  const field = tokens[pos]
  if (field?.type === 'LPAREN') {
    throw new Error('Nested parentheses are not supported')
  }
  if (field?.type !== 'IDENT') throw new Error(`Expected field name at position ${pos}`)

  const op = tokens[pos + 1]
  if (op?.type !== 'OP') throw new Error(`Expected operator after field "${field.value}"`)

  const lit = tokens[pos + 2]
  if (!lit || (lit.type !== 'NUMBER' && lit.type !== 'STRING')) {
    throw new Error(`Expected literal value after operator for field "${field.value}"`)
  }

  const literal = lit.type === 'NUMBER' ? Number(lit.value) : lit.value
  return [{ field: field.value, op: op.value, literal }, pos + 3]
}

function parseExpression(tokens: Token[]): Clause {
  let pos = 0
  const comparisons: Comparison[] = []
  let combinator: 'AND' | 'OR' | null = null

  while (pos < tokens.length) {
    const [comp, nextPos] = parseComparison(tokens, pos)
    comparisons.push(comp)
    pos = nextPos

    if (pos < tokens.length) {
      const joiner = tokens[pos]
      if (joiner.type !== 'AND' && joiner.type !== 'OR') {
        throw new Error(`Expected AND/OR at position ${pos}, got "${joiner.value}"`)
      }
      if (combinator && combinator !== joiner.type) {
        throw new Error('Mixing AND/OR in a single filter expression is not supported — use one combinator')
      }
      combinator = joiner.type
      pos++
    }
  }

  if (comparisons.length === 0) throw new Error('Empty filter expression')
  if (comparisons.length === 1) return comparisons[0]
  return combinator === 'OR' ? { or: comparisons } : { and: comparisons }
}

function evalComparison(row: Record<string, unknown>, c: Comparison): boolean {
  const value = row[c.field]
  switch (c.op) {
    case '>': return Number(value) > Number(c.literal)
    case '<': return Number(value) < Number(c.literal)
    case '>=': return Number(value) >= Number(c.literal)
    case '<=': return Number(value) <= Number(c.literal)
    case '==': return String(value) === String(c.literal)
    case '!=': return String(value) !== String(c.literal)
    default: throw new Error(`Unknown operator: ${c.op}`)
  }
}

function evalClause(row: Record<string, unknown>, clause: Clause): boolean {
  if ('and' in clause) return clause.and.every((c) => evalClause(row, c))
  if ('or' in clause) return clause.or.some((c) => evalClause(row, c))
  return evalComparison(row, clause)
}

export function applyFilter(rows: Record<string, unknown>[], config: FilterConfig): Record<string, unknown>[] {
  const tokens = tokenize(config.expression)
  const clause = parseExpression(tokens)
  return rows.filter((row) => evalClause(row, clause))
}
