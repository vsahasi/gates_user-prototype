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

// Only checks form-visible fields. Update this function when new fields are added to the form.
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
    <div className="flex flex-col">
      <div className="p-4 space-y-3.5">
        {/* Grade */}
        <div className="space-y-1">
          <label htmlFor="profile-grade" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Grade
          </label>
          <select
            id="profile-grade"
            className="w-full rounded-lg border border-border/60 bg-[#fafaf8] px-3 py-2 text-sm focus:border-[#1a6b5a]/30 focus:outline-none focus:ring-1 focus:ring-[#1a6b5a]/20 transition-colors"
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
          <label htmlFor="profile-state" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            State
          </label>
          <select
            id="profile-state"
            className="w-full rounded-lg border border-border/60 bg-[#fafaf8] px-3 py-2 text-sm focus:border-[#1a6b5a]/30 focus:outline-none focus:ring-1 focus:ring-[#1a6b5a]/20 transition-colors"
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
          <label htmlFor="profile-gpa" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            GPA
          </label>
          <input
            id="profile-gpa"
            type="number"
            min={0}
            max={4.0}
            step={0.1}
            className="w-full rounded-lg border border-border/60 bg-[#fafaf8] px-3 py-2 text-sm focus:border-[#1a6b5a]/30 focus:outline-none focus:ring-1 focus:ring-[#1a6b5a]/20 transition-colors"
            value={draft.gpa ?? ''}
            onChange={(e) =>
              setDraft((d) => ({ ...d, gpa: e.target.value ? Math.min(4.0, Math.max(0, Number(e.target.value))) : null }))
            }
            placeholder="e.g. 3.5"
          />
        </div>

        {/* Interests */}
        <div className="space-y-1">
          <label htmlFor="profile-interests" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Interests
          </label>
          <div className="flex gap-1.5">
            <input
              id="profile-interests"
              className="flex-1 rounded-lg border border-border/60 bg-[#fafaf8] px-3 py-2 text-sm focus:border-[#1a6b5a]/30 focus:outline-none focus:ring-1 focus:ring-[#1a6b5a]/20 transition-colors"
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
              className="rounded-lg border border-border/60 bg-[#fafaf8] px-2.5 py-2 text-sm text-muted-foreground hover:bg-[#1a6b5a]/5 hover:text-[#1a6b5a] hover:border-[#1a6b5a]/20 transition-colors"
              onClick={() => addTag('interests', interestInput)}
            >
              +
            </button>
          </div>
          {draft.interests.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1.5">
              {draft.interests.map((interest) => (
                <span
                  key={interest}
                  className="inline-flex items-center gap-1 rounded-full bg-[#1a6b5a]/8 text-[#1a6b5a] px-2.5 py-0.5 text-[11px] font-medium"
                >
                  {interest}
                  <button
                    type="button"
                    onClick={() => removeTag('interests', interest)}
                    className="text-[#1a6b5a]/50 hover:text-[#1a6b5a] leading-none ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Goals */}
        <div className="space-y-1">
          <label htmlFor="profile-goals" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Goals
          </label>
          <div className="flex gap-1.5">
            <input
              id="profile-goals"
              className="flex-1 rounded-lg border border-border/60 bg-[#fafaf8] px-3 py-2 text-sm focus:border-[#1a6b5a]/30 focus:outline-none focus:ring-1 focus:ring-[#1a6b5a]/20 transition-colors"
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
              className="rounded-lg border border-border/60 bg-[#fafaf8] px-2.5 py-2 text-sm text-muted-foreground hover:bg-[#1a6b5a]/5 hover:text-[#1a6b5a] hover:border-[#1a6b5a]/20 transition-colors"
              onClick={() => addTag('goals', goalInput)}
            >
              +
            </button>
          </div>
          {draft.goals.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1.5">
              {draft.goals.map((goal) => (
                <span
                  key={goal}
                  className="inline-flex items-center gap-1 rounded-full bg-[#e07856]/10 text-[#c06040] px-2.5 py-0.5 text-[11px] font-medium"
                >
                  {goal}
                  <button
                    type="button"
                    onClick={() => removeTag('goals', goal)}
                    className="text-[#c06040]/50 hover:text-[#c06040] leading-none ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Update button */}
      <div className="px-4 pb-4">
        <button
          type="button"
          className={`w-full rounded-lg px-3 py-2 text-sm font-medium transition-all ${
            isDirty(draft, profile)
              ? 'bg-[#1a6b5a] text-white shadow-sm hover:bg-[#155a4b] active:scale-[0.98]'
              : 'bg-muted text-muted-foreground/50 cursor-not-allowed'
          }`}
          disabled={!isDirty(draft, profile)}
          onClick={() => onUpdate(draft)}
        >
          Update Profile
        </button>
      </div>
    </div>
  )
}
