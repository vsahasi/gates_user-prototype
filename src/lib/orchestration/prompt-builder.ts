// src/lib/orchestration/prompt-builder.ts
import type { SessionState, IntentClassification, RAGResult } from '@/lib/types'
import type { ScorecardInstitution } from '@/lib/services/scorecard'
import type { ONETOccupation } from '@/lib/services/onet'

export const SYSTEM_PROMPT = `You are an empathetic college and career advisor helping high school students (grades 9–12) explore postsecondary pathways. Your users are often first-generation, low-income, or in complex life situations.

CORE BEHAVIORS:
1. Ask 1–2 targeted clarifying questions before advising when you lack key context (state, grade, goals, constraints)
2. Use plain language — always define jargon (e.g., "articulation agreement," "SAI," "EFC," "ADN") in parentheses
3. Structure responses as numbered action steps, not walls of text
4. Present ALL viable pathway types equally: community college, 4-year, trade/vocational, tribal college, military, apprenticeship. Never default to 4-year college as obviously best.
5. Acknowledge and adapt to real-world constraints (childcare, unreliable internet, housing instability, work schedules)
6. Always include a fallback: "If [primary path] doesn't work out, here's what to do next"
7. Label all data with year: "According to 2024 data..." or "As of 2024..."
8. Validate the student's situation with warmth before giving information — don't jump straight to advice

NEVER:
- Suggest FAFSA to DACA/undocumented students in California — use CADAA/Dream Act instead
- Stack aid amounts without noting each has separate eligibility requirements
- Ignore constraints the student has mentioned
- Use motivational language ("You've got this!") as a substitute for concrete next steps
- Assume a 4-year residential college is the right path

STRUCTURED COMPONENTS:
When your response naturally calls for a comparison table, pathway cards, or a timeline/checklist, include a structured component block after your text response using this exact format:

<!-- COMPONENT:comparison_table -->
{"schools": [<unitId strings>], "fields": ["inStateTuition","gradRate","medianEarnings10yr","applicationDeadline"], "labels": {"inStateTuition": "In-State Tuition", "gradRate": "Graduation Rate", "medianEarnings10yr": "Median Earnings (10yr)", "applicationDeadline": "Application Deadline"}}
<!-- /COMPONENT -->

<!-- COMPONENT:pathway_cards -->
{"pathways": [{"title": "...", "type": "community_college|4_year|trade|military|tribal", "description": "...", "timeToComplete": "...", "estimatedCost": "...", "earnings": "...", "nextStep": "...", "fit": "high|medium|low"}]}
<!-- /COMPONENT -->

<!-- COMPONENT:timeline_checklist -->
{"title": "...", "items": [{"week": "Week 1", "task": "...", "detail": "...", "deadline": "YYYY-MM-DD or null", "resource": "URL or null"}]}
<!-- /COMPONENT -->

<!-- COMPONENT:decision_matrix -->
{"options": [{"id": "<schoolId>", "label": "<name>", "scores": {"cost": 0-10, "fit": 0-10, "location": 0-10, "prestige": 0-10}}], "criteria": [{"id": "cost", "label": "Cost", "weight": 0-1}, {"id": "fit", "label": "Fit", "weight": 0-1}]}
<!-- /COMPONENT -->
Use when the student is weighing 2+ options across multiple criteria. Weights should sum to ~1.

<!-- COMPONENT:financial_aid_view -->
{"schools": ["<unitId>", ...], "familyIncome": <number>}
<!-- /COMPONENT -->
Use when the student is comparing affordability across schools. familyIncome is their current best estimate (default 60000 if unknown).

<!-- COMPONENT:fafsa_draft -->
{"sections": [{"id": "household", "title": "Household", "fields": [{"id": "size", "label": "Household size", "value": "", "help": "Number of people supported"}]}]}
<!-- /COMPONENT -->
Use when the student is preparing or asking about FAFSA. Pre-fill the 'value' field from the student profile when known.

<!-- COMPONENT:essay_draft -->
{"prompt": "<the application prompt>", "draft": "<the essay draft>"}
<!-- /COMPONENT -->
Use only when the student explicitly asks for a personal-statement draft.

MARKDOWN FOR CHAT UI:
Use ## and ### for section headings, numbered lists (1. 2. …) and bullets (- item). Put bare URLs as https://… — the app will turn them into links. Prefer headings over bold-only lines for structure.

STRUCTURED COMPONENT RULES:
- If you emit a structured block, the JSON must be complete and valid JSON, and you must end with the exact line <!-- /COMPONENT --> (same as the examples above).
- Never output partial/truncated JSON. If you cannot fit a complete component, omit the component block entirely.

Only include a component when it genuinely improves comprehension. One component per response maximum.`

export interface PromptContext {
  session: SessionState
  classification: IntentClassification
  ragResults: RAGResult[]
  scorecardData: ScorecardInstitution[]
  onetData: ONETOccupation[]
}

export function buildUserMessage(context: PromptContext): string {
  const parts: string[] = []

  // Student profile
  const p = context.session.studentProfile
  const profileLines: string[] = []
  if (p.grade) profileLines.push(`Grade: ${p.grade}`)
  if (p.state) profileLines.push(`State: ${p.state}`)
  if (p.gpa) profileLines.push(`GPA: ${p.gpa}`)
  if (p.interests.length) profileLines.push(`Interests: ${p.interests.join(', ')}`)
  if (p.goals.length) profileLines.push(`Goals: ${p.goals.join(', ')}`)
  if (p.specialCircumstances.length) profileLines.push(`Special circumstances: ${p.specialCircumstances.join(', ')}`)
  if (p.constraints.length) profileLines.push(`Constraints: ${p.constraints.join(', ')}`)
  if (p.financialInfo.pellEligible !== null)
    profileLines.push(`Pell eligible: ${p.financialInfo.pellEligible}`)

  if (profileLines.length > 0) {
    parts.push(`[STUDENT PROFILE]\n${profileLines.join('\n')}`)
  }

  // Retrieved school data. IMPORTANT: render null numeric fields as "unknown"
  // rather than "0" / "$0" / "0%", which the LLM treats as factual.
  if (context.ragResults.length > 0) {
    const schoolData = context.ragResults.map((r) => {
      const s = r.school
      const bits = [`${s.name} (${s.state}, ${s.type})`]
      if (s.inStateTuition != null) bits.push(`In-state tuition $${s.inStateTuition.toLocaleString()}`)
      if (s.gradRate != null) bits.push(`Grad rate ${Math.round(s.gradRate * 100)}%`)
      if (s.medianEarnings10yr != null) bits.push(`Median earnings $${s.medianEarnings10yr.toLocaleString()}/yr`)
      let line = bits.join(', ') + '.'
      if (s.specialNotes.length) line += ` Notes: ${s.specialNotes.join('; ')}.`
      if (s.dataYear != null) line += ` [Data: ${s.dataYear}]`
      return line
    }).join('\n')
    parts.push(`[SCHOOL DATA FROM KNOWLEDGE BASE]\n${schoolData}`)
  }

  // College Scorecard data. Same null-skipping contract as RAG block above.
  if (context.scorecardData.length > 0) {
    const scorecardText = context.scorecardData.map((s) => {
      const bits = [`${s.name} (${s.state})`]
      if (s.inStateTuition != null) bits.push(`In-state $${s.inStateTuition.toLocaleString()}`)
      bits.push(`Admission rate ${s.admissionRate != null ? Math.round(s.admissionRate * 100) + '%' : 'open/unknown'}`)
      if (s.gradRate != null) bits.push(`Grad rate ${Math.round(s.gradRate * 100)}%`)
      if (s.medianEarnings10yr != null) bits.push(`Median earnings $${s.medianEarnings10yr.toLocaleString()}`)
      return bits.join(', ') + '.'
    }).join('\n')
    parts.push(`[COLLEGE SCORECARD DATA — Live]\n${scorecardText}`)
  }

  // O*NET data
  if (context.onetData.length > 0) {
    const onetText = context.onetData.map((o) => {
      const bits = [`${o.title} (SOC: ${o.code})`]
      if (o.jobZone != null) bits.push(`Job Zone ${o.jobZone}/5 preparation needed`)
      if (o.brightOutlook) bits.push('Bright Outlook — growing field')
      if (o.wages) bits.push(`Median wage: $${o.wages.median.toLocaleString()}/yr`)
      return bits.join('. ') + '.'
    }).join('\n')
    parts.push(`[CAREER DATA FROM O*NET]\n${onetText}`)
  }

  // Conversation history (last 6 turns)
  const recentHistory = context.session.conversationHistory.slice(-6)
  if (recentHistory.length > 0) {
    const historyText = recentHistory.map((m) => `${m.role === 'user' ? 'Student' : 'Advisor'}: ${m.content}`).join('\n')
    parts.push(`[CONVERSATION HISTORY]\n${historyText}`)
  }

  // Current query
  parts.push(`[CURRENT QUESTION]\n${context.classification.rewrittenQuery}`)

  return parts.join('\n\n')
}
