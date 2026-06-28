export type DeriveOperator = '+' | '-' | '*' | '/'

export interface DeriveRule {
  outputField: string
  left: string // field name or numeric literal
  operator: DeriveOperator
  right: string // field name or numeric literal
}

export interface DeriveConfig {
  rules: DeriveRule[]
}

function resolveOperand(row: Record<string, unknown>, operand: string): number {
  const literal = Number(operand)
  const value = Number.isNaN(literal) ? row[operand] : literal
  const n = Number(value)
  if (Number.isNaN(n)) throw new Error(`Cannot resolve operand "${operand}" to a number`)
  return n
}

function applyOperator(left: number, op: DeriveOperator, right: number): number {
  switch (op) {
    case '+': return left + right
    case '-': return left - right
    case '*': return left * right
    case '/':
      if (right === 0) throw new Error('Division by zero in derive transform')
      return left / right
  }
}

export function applyDerive(rows: Record<string, unknown>[], config: DeriveConfig): Record<string, unknown>[] {
  return rows.map((row) => {
    const derived: Record<string, unknown> = { ...row }
    for (const rule of config.rules) {
      const left = resolveOperand(row, rule.left)
      const right = resolveOperand(row, rule.right)
      derived[rule.outputField] = applyOperator(left, rule.operator, right)
    }
    return derived
  })
}
