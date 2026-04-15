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

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
          Your Profile
        </h3>

        {/* Grade */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Grade</label>
          <select
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            value={draft.grade ?? ''}
            onChange={(e) =>
              setDraft((d) => ({ ...d, grade: e.target.value ? Number(e.target.value) : null }))
            }
          >
            <option value="">Select grade</option>
            {GRADE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* State */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">State</label>
          <select
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            value={draft.state ?? ''}
            onChange={(e) =>
              setDraft((d) => ({ ...d, state: e.target.value || null }))
            }
          >
            <option value="">Select state</option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* GPA */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">GPA</label>
          <input
            type="number"
            min={0}
            max={4.0}
            step={0.1}
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            value={draft.gpa ?? ''}
            onChange={(e) =>
              setDraft((d) => ({ ...d, gpa: e.target.value ? Number(e.target.value) : null }))
            }
            placeholder="e.g. 3.5"
          />
        </div>

        {/* Interests */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Interests</label>
          <div className="flex gap-1">
            <input
              className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
              placeholder="Add interest…"
              value={interestInput}
              onChange={(e) => setInterestInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  addTag('interests', interestInput)
                }
              }}
            />
            <button
              type="button"
              className="rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted"
              onClick={() => addTag('interests', interestInput)}
            >
              +
            </button>
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            {draft.interests.map((interest) => (
              <span
                key={interest}
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
              >
                {interest}
                <button
                  type="button"
                  onClick={() => removeTag('interests', interest)}
                  className="text-muted-foreground hover:text-foreground leading-none"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Goals */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Goals</label>
          <div className="flex gap-1">
            <input
              className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
              placeholder="Add goal…"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  addTag('goals', goalInput)
                }
              }}
            />
            <button
              type="button"
              className="rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted"
              onClick={() => addTag('goals', goalInput)}
            >
              +
            </button>
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            {draft.goals.map((goal) => (
              <span
                key={goal}
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
              >
                {goal}
                <button
                  type="button"
                  onClick={() => removeTag('goals', goal)}
                  className="text-muted-foreground hover:text-foreground leading-none"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Update button */}
      <div className="p-4 border-t shrink-0">
        <button
          type="button"
          className="w-full rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!isDirty(draft, profile)}
          onClick={() => onUpdate(draft)}
        >
          Update Profile
        </button>
      </div>
    </div>
  )
}
