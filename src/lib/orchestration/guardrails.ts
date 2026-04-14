// src/lib/orchestration/guardrails.ts

export interface GuardrailResult {
  passed: boolean
  reason?: string
  sanitized?: string
}

// --- Input guardrails ---

const PII_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN
  /\b\d{9}\b/, // SSN no dashes
  /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/, // phone number
]

const INJECTION_PATTERNS = [
  /ignore (previous|all|prior) (instructions?|prompts?|system)/i,
  /you are now|pretend (you are|to be)|act as (if you are|a)/i,
  /\[\[.*system.*\]\]/i,
  /<\/s>\s*<s>/i,
]

export function checkInputGuardrails(message: string): GuardrailResult {
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(message)) {
      return {
        passed: false,
        reason: 'Message appears to contain sensitive personal information (SSN or phone number). Please do not share sensitive identifiers.',
      }
    }
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(message)) {
      return {
        passed: false,
        reason: 'Message contains content that cannot be processed. Please ask a question about college or career planning.',
      }
    }
  }

  if (message.trim().length < 2) {
    return { passed: false, reason: 'Message too short.' }
  }

  return { passed: true }
}

// --- Output guardrails ---

export interface OutputGuardrailResult {
  passed: boolean
  response: string // potentially modified
  warnings: string[]
}

export function checkOutputGuardrails(
  response: string,
  retrievedData: string
): OutputGuardrailResult {
  const warnings: string[] = []

  // Check for common hallucination patterns: specific dollar amounts not in retrieved data
  const dollarAmounts = response.match(/\$[\d,]+/g) ?? []
  for (const amount of dollarAmounts) {
    const num = amount.replace(/[$,]/g, '')
    if (!retrievedData.includes(num) && !retrievedData.includes(amount)) {
      warnings.push(`Unverified dollar amount: ${amount}`)
    }
  }

  // Strip any accidental PII echoing
  let sanitized = response
  for (const pattern of PII_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]')
  }

  return {
    passed: warnings.length === 0,
    response: sanitized,
    warnings,
  }
}

export function formatDataVintageDisclosure(dataYear: number): string {
  return `\n\n*Data note: School-specific figures are from ${dataYear}. Verify current amounts directly with each institution.*`
}
