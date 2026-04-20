'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  User, 
  Palette, 
  Bell, 
  Shield, 
  Database, 
  Trash2, 
  Download, 
  Moon, 
  Sun,
  Monitor,
  Check,
  ChevronLeft,
  LogOut,
  HelpCircle,
  FileText,
  Info
} from 'lucide-react'
import { signOut } from 'next-auth/react'
import { loadConversations, saveConversations } from '@/lib/utils'
import type { Conversation } from '@/lib/types'

type Theme = 'light' | 'dark' | 'system'
type Tab = 'profile' | 'appearance' | 'data' | 'privacy'

export default function SettingsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [theme, setTheme] = useState<Theme>('system')
  const [accentColor, setAccentColor] = useState('#3b82f6')
  const [displayName, setDisplayName] = useState('')
  const [profileImage, setProfileImage] = useState('')
  const [notifications, setNotifications] = useState(true)
  const [autoSave, setAutoSave] = useState(true)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [deleteSuccess, setDeleteSuccess] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [loadingPrefs, setLoadingPrefs] = useState(false)

  // Load theme preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme
    if (savedTheme) setTheme(savedTheme)
    
    const savedAccent = localStorage.getItem('accentColor')
    if (savedAccent) {
      setAccentColor(savedAccent)
      document.documentElement.style.setProperty('--accent', savedAccent)
    }
    
    const savedNotifications = localStorage.getItem('notifications')
    if (savedNotifications !== null) setNotifications(savedNotifications === 'true')
    
    const savedAutoSave = localStorage.getItem('autoSave')
    if (savedAutoSave !== null) setAutoSave(savedAutoSave === 'true')
    
    // Load user preferences from database
    if (session?.user?.email) {
      loadUserPreferences()
    }
  }, [session])

  // Apply theme
  useEffect(() => {
    localStorage.setItem('theme', theme)
    
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark')
    } else {
      // System preference
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
  }, [theme])

  // Save preferences
  useEffect(() => {
    localStorage.setItem('notifications', notifications.toString())
    localStorage.setItem('autoSave', autoSave.toString())
    localStorage.setItem('accentColor', accentColor)
    document.documentElement.style.setProperty('--accent', accentColor)
    
    // Also save accent color to database if user is logged in
    if (session?.user?.email && accentColor) {
      const timeoutId = setTimeout(() => {
        fetch('/api/user-preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accentColor })
        }).catch(err => console.error('Error saving accent color:', err))
      }, 1000) // Debounce by 1 second
      
      return () => clearTimeout(timeoutId)
    }
  }, [notifications, autoSave, accentColor, session])

  // Load user preferences from database
  const loadUserPreferences = async () => {
    if (!session?.user?.email) return
    
    setLoadingPrefs(true)
    try {
      const res = await fetch('/api/user-preferences')
      if (res.ok) {
        const data = await res.json()
        if (data.displayName) setDisplayName(data.displayName)
        if (data.profileImage) setProfileImage(data.profileImage)
        if (data.accentColor) {
          setAccentColor(data.accentColor)
          localStorage.setItem('accentColor', data.accentColor)
          document.documentElement.style.setProperty('--accent', data.accentColor)
        }
      }
    } catch (error) {
      console.error('Error loading user preferences:', error)
    } finally {
      setLoadingPrefs(false)
    }
  }

  // Save user preferences to database
  const saveUserPreferences = async () => {
    if (!session?.user?.email) return
    
    try {
      const res = await fetch('/api/user-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, profileImage, accentColor })
      })
      
      if (res.ok) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      }
    } catch (error) {
      console.error('Error saving user preferences:', error)
    }
  }

  // Export conversations
  const handleExport = () => {
    const conversations = loadConversations()
    const dataStr = JSON.stringify(conversations, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `nexus-ai-chats-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
    
    setExportSuccess(true)
    setTimeout(() => setExportSuccess(false), 3000)
  }

  // Clear all conversations
  const handleClearAll = () => {
    saveConversations([])
    setShowConfirmDelete(false)
    setDeleteSuccess(true)
    setTimeout(() => setDeleteSuccess(false), 3000)
    
    // Refresh the page to clear state
    setTimeout(() => router.refresh(), 500)
  }

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'data', label: 'Data & Storage', icon: Database },
    { id: 'privacy', label: 'Privacy', icon: Shield },
  ]

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Header */}
      <header className="border-b border-[var(--surface-border)] bg-[var(--bg-secondary)]">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-4"
          >
            <ChevronLeft size={20} />
            Back to Chat
          </button>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Settings</h1>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="md:col-span-1">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-[var(--accent)] text-[var(--bg)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--surface)]'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                )
              })}
              
              <button
                onClick={() => signOut()}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors mt-4"
              >
                <LogOut size={18} />
                <span className="font-medium">Sign Out</span>
              </button>
              
              <div className="pt-4 mt-4 border-t border-[var(--surface-border)]">
                <p className="px-4 text-xs font-semibold text-[var(--text-muted)] mb-2">
                  RESOURCES
                </p>
                <Link
                  href="/about"
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface)] transition-colors"
                >
                  <Info size={18} />
                  <span>About</span>
                </Link>
                <Link
                  href="/help"
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface)] transition-colors"
                >
                  <HelpCircle size={18} />
                  <span>Help Center</span>
                </Link>
                <Link
                  href="/terms"
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface)] transition-colors"
                >
                  <FileText size={18} />
                  <span>Terms of Use</span>
                </Link>
              </div>
            </nav>
          </div>

          {/* Content */}
          <div className="md:col-span-3 space-y-6">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                    Account Information
                  </h2>
                  
                  <div className="flex items-start gap-4 mb-6">
                    {session?.user?.image ? (
                      <img
                        src={session.user.image}
                        alt={session.user.name || 'User'}
                        className="w-20 h-20 rounded-full"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-[var(--accent)] flex items-center justify-center text-2xl font-bold text-[var(--bg)]">
                        {session?.user?.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    )}
                    <div>
                      <h3 className="text-xl font-semibold text-[var(--text-primary)]">
                        {session?.user?.name}
                      </h3>
                      <p className="text-[var(--text-secondary)]">{session?.user?.email}</p>
                      <p className="text-sm text-[var(--text-muted)] mt-1">
                        Signed in with Google
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={displayName || session?.user?.name || ''}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Enter your name"
                        className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                      />
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        This name will be shown in the app
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                        Profile Picture URL
                      </label>
                      <input
                        type="url"
                        value={profileImage || session?.user?.image || ''}
                        onChange={(e) => setProfileImage(e.target.value)}
                        placeholder="https://example.com/photo.jpg"
                        className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                      />
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        Enter a URL for your profile picture
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={session?.user?.email || ''}
                        disabled
                        className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--text-primary)] opacity-50 cursor-not-allowed"
                      />
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        Your email is managed by Google
                      </p>
                    </div>

                    <button
                      onClick={saveUserPreferences}
                      className="w-full px-4 py-2 bg-[var(--accent)] text-[var(--bg)] rounded-lg hover:opacity-90 transition-opacity font-medium flex items-center justify-center gap-2"
                    >
                      {loadingPrefs ? (
                        <>
                          <div className="w-4 h-4 border-2 border-[var(--bg)] border-t-transparent rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </button>

                    {saveSuccess && (
                      <p className="text-sm text-green-500 flex items-center gap-2 justify-center">
                        <Check size={16} />
                        Profile updated successfully!
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Appearance Tab */}
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                    Theme
                  </h2>
                  
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { id: 'light', label: 'Light', icon: Sun },
                      { id: 'dark', label: 'Dark', icon: Moon },
                      { id: 'system', label: 'System', icon: Monitor },
                    ].map((t) => {
                      const Icon = t.icon
                      return (
                        <button
                          key={t.id}
                          onClick={() => setTheme(t.id as Theme)}
                          className={`flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                            theme === t.id
                              ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                              : 'border-[var(--surface-border)] hover:border-[var(--text-muted)]'
                          }`}
                        >
                          <Icon size={24} className="text-[var(--text-primary)]" />
                          <span className="text-sm font-medium text-[var(--text-primary)]">
                            {t.label}
                          </span>
                          {theme === t.id && (
                            <Check size={16} className="text-[var(--accent)]" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                    Accent Color
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">
                    Choose your preferred accent color for buttons and highlights.
                  </p>
                  
                  <div className="grid grid-cols-6 gap-3 mb-4">
                    {[
                      '#3b82f6', // Blue (default)
                      '#8b5cf6', // Purple
                      '#ec4899', // Pink
                      '#ef4444', // Red
                      '#f97316', // Orange
                      '#eab308', // Yellow
                      '#22c55e', // Green
                      '#06b6d4', // Cyan
                      '#6366f1', // Indigo
                      '#14b8a6', // Teal
                    ].map((color) => (
                      <button
                        key={color}
                        onClick={() => setAccentColor(color)}
                        className={`w-10 h-10 rounded-full border-2 transition-all hover:scale-110 ${
                          accentColor === color
                            ? 'border-[var(--text-primary)] scale-110 shadow-lg'
                            : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      >
                        {accentColor === color && (
                          <Check size={16} className="text-white mx-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-12 h-12 rounded-lg cursor-pointer border border-[var(--surface-border)]"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[var(--text-primary)]">Custom Color</p>
                      <p className="text-xs text-[var(--text-muted)]">{accentColor}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                    Preferences
                  </h2>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">Notifications</p>
                        <p className="text-sm text-[var(--text-muted)]">
                          Enable desktop notifications
                        </p>
                      </div>
                      <button
                        onClick={() => setNotifications(!notifications)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          notifications ? 'bg-[var(--accent)]' : 'bg-[var(--surface-border)]'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            notifications ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">Auto-save Chats</p>
                        <p className="text-sm text-[var(--text-muted)]">
                          Automatically save conversations
                        </p>
                      </div>
                      <button
                        onClick={() => setAutoSave(!autoSave)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          autoSave ? 'bg-[var(--accent)]' : 'bg-[var(--surface-border)]'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            autoSave ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Data & Storage Tab */}
            {activeTab === 'data' && (
              <div className="space-y-6">
                <div className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                    Export Data
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">
                    Download all your conversations as a JSON file for backup.
                  </p>
                  
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-[var(--bg)] rounded-lg hover:opacity-90 transition-opacity font-medium"
                  >
                    <Download size={18} />
                    Export Conversations
                  </button>
                  
                  {exportSuccess && (
                    <p className="mt-3 text-sm text-green-500 flex items-center gap-2">
                      <Check size={16} />
                      Exported successfully!
                    </p>
                  )}
                </div>

                <div className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                    Clear Local Data
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">
                    Delete all conversations stored in your browser. This action cannot be undone.
                  </p>
                  
                  {!showConfirmDelete ? (
                    <button
                      onClick={() => setShowConfirmDelete(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors font-medium"
                    >
                      <Trash2 size={18} />
                      Clear All Conversations
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-red-500 font-medium">
                        Are you sure? This will delete all local conversations.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={handleClearAll}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
                        >
                          Yes, Delete Everything
                        </button>
                        <button
                          onClick={() => setShowConfirmDelete(false)}
                          className="px-4 py-2 bg-[var(--surface)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {deleteSuccess && (
                    <p className="mt-3 text-sm text-green-500 flex items-center gap-2">
                      <Check size={16} />
                      All conversations cleared!
                    </p>
                  )}
                </div>

                <div className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                    Cloud Sync Status
                  </h2>
                  {session ? (
                    <div className="flex items-center gap-3 text-green-500">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <p className="text-sm font-medium">
                        Connected - Your chats are synced to the cloud
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-[var(--text-muted)]">
                      <div className="w-2 h-2 bg-[var(--text-muted)] rounded-full" />
                      <p className="text-sm">
                        Not signed in - Chats are stored locally only
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Privacy Tab */}
            {activeTab === 'privacy' && (
              <div className="space-y-6">
                <div className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                    Privacy & Security
                  </h2>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-[var(--surface)] rounded-lg">
                      <h3 className="font-medium text-[var(--text-primary)] mb-2">
                        Data Storage
                      </h3>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {session 
                          ? 'Your conversations are securely stored in MongoDB Atlas cloud database and synced across devices.'
                          : 'Your conversations are stored locally in your browser. Sign in to enable cloud sync.'
                        }
                      </p>
                    </div>

                    <div className="p-4 bg-[var(--surface)] rounded-lg">
                      <h3 className="font-medium text-[var(--text-primary)] mb-2">
                        Authentication
                      </h3>
                      <p className="text-sm text-[var(--text-secondary)]">
                        We use NextAuth.js with Google OAuth for secure authentication. We never store your password.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                    Session Management
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">
                    Sign out from all devices and clear your session.
                  </p>
                  
                  <button
                    onClick={() => signOut()}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors font-medium"
                  >
                    <LogOut size={18} />
                    Sign Out Everywhere
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
