// src/components/panels/ProfilePanel.tsx
import type { StudentProfile } from '@/lib/types'
import { Badge } from '@/components/ui/badge'

interface ProfilePanelProps {
  profile: StudentProfile
}

export function ProfilePanel({ profile }: ProfilePanelProps) {
  const hasAnyData = profile.grade || profile.state || profile.interests.length || profile.goals.length

  if (!hasAnyData) return null

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3 text-sm">
      <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Your Profile</h3>
      <div className="space-y-2">
        {profile.grade && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Grade</span>
            <span className="font-medium">{profile.grade}</span>
          </div>
        )}
        {profile.state && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">State</span>
            <span className="font-medium">{profile.state}</span>
          </div>
        )}
        {profile.gpa && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">GPA</span>
            <span className="font-medium">{profile.gpa}</span>
          </div>
        )}
        {profile.interests.length > 0 && (
          <div className="space-y-1">
            <span className="text-muted-foreground">Interests</span>
            <div className="flex flex-wrap gap-1">
              {profile.interests.map((i) => (
                <Badge key={i} variant="secondary" className="text-xs">{i}</Badge>
              ))}
            </div>
          </div>
        )}
        {profile.specialCircumstances.length > 0 && (
          <div className="space-y-1">
            <span className="text-muted-foreground">Circumstances</span>
            <div className="flex flex-wrap gap-1">
              {profile.specialCircumstances.map((c) => (
                <Badge key={c} variant="outline" className="text-xs">{c.replace(/_/g, ' ')}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
