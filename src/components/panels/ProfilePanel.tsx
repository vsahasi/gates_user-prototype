'use client'
// src/components/panels/ProfilePanel.tsx
import { useState, useEffect } from 'react'
import type { StudentProfile } from '@/lib/types'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
]

const GRADE_OPTIONS = [
  { value: 9,  label: '9th Grade' },
  { value: 10, label: '10th Grade' },
  { value: 11, label: '11th Grade' },
  { value: 12, label: '12th Grade' },
  { value: 13, label: 'Graduated / GED' },
  { value: 14, label: 'Adult Learner' },
]

type DraftShape = Pick<StudentProfile, 'grade' | 'state' | 'gpa' | 'interests' | 'goals'>

export function isDirty(draft: DraftShape, profile: DraftShape): boolean {
  return (
    draft.grade !== profile.grade ||
    draft.state !== profile.state ||
    draft.gpa !== profile.gpa ||
    JSON.stringify(draft.interests) !== JSON.stringify(profile.interests) ||
    JSON.stringify(draft.goals) !== JSON.stringify(profile.goals)
  )
}

interface ProfilePanelProps {
  profile: StudentProfile
  onUpdate: (updated: StudentProfile) => void
}

export function ProfilePanel({ profile, onUpdate }: ProfilePanelProps) {
  const [draft, setDraft] = useState<StudentProfile>(profile)
  const [interestInput, setInterestInput] = useState('')
  const [goalInput, setGoalInput] = useState('')

  useEffect(() => {
    setDraft(profile)
    setInterestInput('')
    setGoalInput('')
  }, [profile])

  function addTag(field: 'interests' | 'goals', value: string) {
    const trimmed = value.trim().replace(/,$/, '')
    if (!trimmed) return
    setDraft((d) => ({ ...d, [field]: [...new Set([...d[field], trimmed])] }))
    if (field === 'interests') setInterestInput('')
    else setGoalInput('')
  }

  function removeTag(field: 'interests' | 'goals', value: string) {
    setDraft((d) => ({ ...d, [field]: d[field].filter((v) => v !== value) }))
  }

  const dirty = isDirty(draft, profile)

  return (
    <div className="space-y-5">
      {/* Inline grid for short facts */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <Field label="Grade">
          <select
            className="field-line w-full"
            value={draft.grade ?? ''}
            onChange={(e) =>
              setDraft((d) => ({ ...d, grade: e.target.value ? Number(e.target.value) : null }))
            }
          >
            <option value="">—</option>
            {GRADE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>

        <Field label="State">
          <select
            className="field-line w-full"
            value={draft.state ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, state: e.target.value || null }))}
          >
            <option value="">—</option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>

        <Field label="GPA">
          <input
            type="number"
            min={0}
            max={4.0}
            step={0.1}
            className="field-line w-full tabular-nums"
            value={draft.gpa ?? ''}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                gpa: e.target.value ? Math.min(4.0, Math.max(0, Number(e.target.value))) : null,
              }))
            }
            placeholder="3.5"
          />
        </Field>
      </div>

      {/* Interests */}
      <Field label="Interests">
        <TagInput
          value={interestInput}
          setValue={setInterestInput}
          onAdd={() => addTag('interests', interestInput)}
          placeholder="What lights you up?"
        />
        {draft.interests.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {draft.interests.map((t) => (
              <Tag key={t} variant="forest" onRemove={() => removeTag('interests', t)}>
                {t}
              </Tag>
            ))}
          </div>
        )}
      </Field>

      {/* Goals */}
      <Field label="Goals">
        <TagInput
          value={goalInput}
          setValue={setGoalInput}
          onAdd={() => addTag('goals', goalInput)}
          placeholder="Something you're aiming for…"
        />
        {draft.goals.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {draft.goals.map((g) => (
              <Tag key={g} variant="rust" onRemove={() => removeTag('goals', g)}>
                {g}
              </Tag>
            ))}
          </div>
        )}
      </Field>

      <button
        type="button"
        className={`w-full text-[13px] font-medium py-2 rounded-sm transition-all border ${
          dirty
            ? 'border-ink bg-ink text-paper hover:bg-black'
            : 'border-rule bg-transparent text-ink-faint cursor-not-allowed'
        }`}
        disabled={!dirty}
        onClick={() => onUpdate(draft)}
      >
        {dirty ? 'Save changes →' : 'Saved'}
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="eyebrow mb-1">{label}</div>
      {children}
    </label>
  )
}

function TagInput({
  value,
  setValue,
  onAdd,
  placeholder,
}: {
  value: string
  setValue: (v: string) => void
  onAdd: () => void
  placeholder?: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        className="field-line flex-1"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            onAdd()
          }
        }}
      />
      <button
        type="button"
        onClick={onAdd}
        className="text-[18px] leading-none px-1.5 py-1 text-ink-soft hover:text-forest transition-colors font-display"
        aria-label="Add"
      >
        +
      </button>
    </div>
  )
}

function Tag({
  children,
  onRemove,
  variant,
}: {
  children: React.ReactNode
  onRemove: () => void
  variant: 'forest' | 'rust'
}) {
  const styles =
    variant === 'forest'
      ? 'bg-forest-soft text-forest-deep border-forest/20'
      : 'bg-rust-soft text-rust border-rust/25'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11.5px] font-medium ${styles}`}
    >
      {children}
      <button
        type="button"
        onClick={onRemove}
        className="opacity-50 hover:opacity-100 leading-none ml-0.5"
        aria-label={`Remove ${children}`}
      >
        ×
      </button>
    </span>
  )
}
