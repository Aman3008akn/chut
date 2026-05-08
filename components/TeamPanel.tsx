'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Users, Plus, Mail, X, Check, 
  MessageSquare, Settings, UserPlus, Loader2
} from 'lucide-react'

interface Team {
  id: string
  name: string
  description: string
  ownerId: string
  members: Array<{
    userId: string
    role: 'owner' | 'admin' | 'member'
    joinedAt: number
  }>
  conversations: string[]
  createdAt: number
  updatedAt: number
}

interface TeamPanelProps {
  userId: string
  isOpen: boolean
  onClose: () => void
  onSelectTeam: (team: Team) => void
}

export default function TeamPanel({
  userId,
  isOpen,
  onClose,
  onSelectTeam,
}: TeamPanelProps) {
  const [teams, setTeams] = useState<Team[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [teamDescription, setTeamDescription] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')

  useEffect(() => {
    if (isOpen && userId) {
      loadTeams()
    }
  }, [isOpen, userId])

  useEffect(() => {
    if (!isOpen || !userId) return
    const timer = setInterval(loadTeams, 2500)
    return () => clearInterval(timer)
  }, [isOpen, userId])

  const loadTeams = async () => {
    try {
      const res = await fetch(`/api/teams?userId=${userId}`)
      if (res.ok) {
        const data = await res.json()
        setTeams(data)
      }
    } catch (error) {
      console.error('Error loading teams:', error)
    }
  }

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      alert('Please enter a team name')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: teamName,
          description: teamDescription,
          userId,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        const newTeam = data
        setTeams([...teams, newTeam])
        setTeamName('')
        setTeamDescription('')
        setShowCreateForm(false)
        alert('Team created successfully!')
      } else {
        alert(`Error: ${data.error || 'Failed to create team'}`)
      }
    } catch (error) {
      console.error('Error creating team:', error)
      alert('Failed to create team. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async () => {
    if (!selectedTeam || !inviteEmail.trim()) {
      alert('Please enter a username')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_member_by_username',
          teamId: selectedTeam.id,
          userId,
          usernameToAdd: inviteEmail,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setSelectedTeam(data)
        setTeams(prev => prev.map(t => (t.id === data.id ? data : t)))
        setInviteEmail('')
        alert('Member added instantly')
      } else {
        alert(`Error: ${data.error || 'Failed to add member'}`)
      }
    } catch (error) {
      console.error('Error sending invitation:', error)
      alert('Failed to add member. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] 
                   rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--surface-border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--accent)]/10 rounded-lg">
              <Users size={24} className="text-[var(--accent)]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Teams</h2>
              <p className="text-sm text-[var(--text-secondary)]">Collaborate with your team</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--surface)] rounded-lg transition-colors"
          >
            <X size={20} className="text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {!selectedTeam ? (
            <>
              {/* Teams List */}
              <div className="space-y-3 mb-6">
                {teams.map(team => (
                  <button
                    key={team.id}
                    onClick={() => {
                      setSelectedTeam(team)
                      onSelectTeam(team)
                    }}
                    className="w-full p-4 bg-[var(--surface)] border border-[var(--surface-border)] 
                             rounded-xl hover:border-[var(--accent)] transition-all text-left"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-[var(--text-primary)]">{team.name}</h3>
                      <span className="text-xs text-[var(--text-muted)]">
                        {team.members.length} {team.members.length === 1 ? 'member' : 'members'}
                      </span>
                    </div>
                    {team.description && (
                      <p className="text-sm text-[var(--text-secondary)]">{team.description}</p>
                    )}
                  </button>
                ))}

                {teams.length === 0 && (
                  <div className="text-center py-12 text-[var(--text-muted)]">
                    <Users size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="text-sm">No teams yet. Create your first team!</p>
                  </div>
                )}
              </div>

              {/* Create Team Button */}
              {!showCreateForm ? (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full p-4 border-2 border-dashed border-[var(--surface-border)] 
                           rounded-xl hover:border-[var(--accent)] transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={20} className="text-[var(--accent)]" />
                  <span className="text-sm font-medium text-[var(--accent)]">Create New Team</span>
                </button>
              ) : (
                <div className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl p-4 space-y-3">
                  <input
                    type="text"
                    placeholder="Team name"
                    value={teamName}
                    onChange={e => setTeamName(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--surface-border)] 
                             rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                  />
                  <textarea
                    placeholder="Description (optional)"
                    value={teamDescription}
                    onChange={e => setTeamDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--surface-border)] 
                             rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCreateForm(false)}
                      className="flex-1 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateTeam}
                      disabled={loading || !teamName.trim()}
                      className="flex-1 px-3 py-2 bg-[var(--accent)] text-white rounded-lg text-sm 
                               font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                      Create Team
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Team Details */}
              <div className="mb-6">
                <button
                  onClick={() => {
                    setSelectedTeam(null)
                    setShowInviteForm(false)
                  }}
                  className="text-sm text-[var(--accent)] hover:underline mb-3"
                >
                  ← Back to Teams
                </button>
                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">{selectedTeam.name}</h3>
                {selectedTeam.description && (
                  <p className="text-sm text-[var(--text-secondary)]">{selectedTeam.description}</p>
                )}
              </div>

              {/* Members */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                  Members ({selectedTeam.members.length})
                </h4>
                <div className="space-y-2">
                  {selectedTeam.members.map((member, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-[var(--surface)] rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[var(--accent)]/20 flex items-center justify-center">
                          <span className="text-xs font-bold text-[var(--accent)]">
                            {member.userId.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm text-[var(--text-primary)]">{member.userId}</span>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
                        {member.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Invite Section */}
              {!showInviteForm ? (
                <button
                  onClick={() => setShowInviteForm(true)}
                  className="w-full p-3 border border-[var(--surface-border)] rounded-lg 
                           hover:border-[var(--accent)] transition-all flex items-center justify-center gap-2"
                >
                  <UserPlus size={16} className="text-[var(--accent)]" />
                  <span className="text-sm text-[var(--accent)]">Add by Username</span>
                </button>
              ) : (
                <div className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl p-4 space-y-3">
                  <input
                    type="text"
                    placeholder="Enter username"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--surface-border)] 
                             rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                  />
                  <button
                    onClick={handleInvite}
                    disabled={loading || !inviteEmail.trim()}
                    className="w-full px-3 py-2 bg-[var(--accent)] text-white rounded-lg text-sm 
                             font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                    Add Member
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
