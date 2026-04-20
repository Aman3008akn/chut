'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Settings, Users, Database, MessageSquare, BarChart3, ChevronLeft, Save, RefreshCw, AlertTriangle } from 'lucide-react'

const ADMIN_EMAIL = 'declined8087@gmail.com'

export default function AdminDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ totalUsers: 0, totalConversations: 0, totalMessages: 0, activeToday: 0 })
  const [siteConfig, setSiteConfig] = useState({
    siteName: 'Nexus AI',
    welcomeMessage: 'Welcome to Nexus AI',
    maxMessageLength: 4000,
    enableDeepResearch: true,
    maintenanceMode: false
  })
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated' || session?.user?.email !== ADMIN_EMAIL) {
      router.push('/')
    }
  }, [session, status, router])

  useEffect(() => {
    if (session?.user?.email === ADMIN_EMAIL) {
      loadStats()
      loadSiteConfig()
    }
  }, [session])

  const loadStats = async () => {
    try {
      const res = await fetch('/api/admin/stats')
      if (res.ok) setStats(await res.json())
    } catch (error) { console.error('Error loading stats:', error) }
  }

  const loadSiteConfig = async () => {
    try {
      const res = await fetch('/api/admin/config', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        if (data.config) {
          setSiteConfig(prev => ({ ...prev, ...data.config }))
        }
      }
    } catch (error) { console.error('Error loading config:', error) }
  }

  const saveSiteConfig = async () => {
    setLoading(true)
    console.log('Attempting to save config:', siteConfig)
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: siteConfig })
      })
      
      console.log('Response status:', res.status)
      const data = await res.json()
      console.log('Response data:', data)
      
      if (res.ok) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
        await loadSiteConfig()
      } else {
        console.error('Save failed with status:', res.status, data)
        alert(`Failed to save configuration: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error saving config:', error)
      alert(`Error saving configuration: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--text-secondary)]">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  if (!session || session.user?.email !== ADMIN_EMAIL) return null

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'settings', label: 'Site Settings', icon: Settings },
    { id: 'users', label: 'Users', icon: Users },
  ]

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="border-b border-[var(--surface-border)] bg-[var(--bg-secondary)]">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => router.back()} className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                <ChevronLeft size={20} /> Back to App
              </button>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Admin Dashboard</h1>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-500 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium">Admin Access</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-1">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === tab.id ? 'bg-[var(--accent)] text-[var(--bg)]' : 'text-[var(--text-secondary)] hover:bg-[var(--surface)]'}`}>
                    <Icon size={18} /><span className="font-medium">{tab.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>

          <div className="lg:col-span-4 space-y-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">System Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Users', value: stats.totalUsers, color: 'blue' },
                    { label: 'Conversations', value: stats.totalConversations, color: 'green' },
                    { label: 'Messages', value: stats.totalMessages, color: 'purple' },
                    { label: 'Active Today', value: stats.activeToday, color: 'orange' },
                  ].map((stat, index) => (
                    <div key={index} className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl p-6">
                      <p className="text-3xl font-bold text-[var(--text-primary)] mb-1">{stat.value}</p>
                      <p className="text-sm text-[var(--text-muted)]">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl p-6">
                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-6">Site Configuration</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                      Site Name
                    </label>
                    <input
                      type="text"
                      value={siteConfig.siteName}
                      onChange={(e) => setSiteConfig({...siteConfig, siteName: e.target.value})}
                      className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                      placeholder="Enter site name"
                    />
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      This name will be displayed throughout the application
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                      Welcome Message
                    </label>
                    <input
                      type="text"
                      value={siteConfig.welcomeMessage}
                      onChange={(e) => setSiteConfig({...siteConfig, welcomeMessage: e.target.value})}
                      className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                      placeholder="Enter welcome message"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                      Max Message Length (characters)
                    </label>
                    <input
                      type="number"
                      value={siteConfig.maxMessageLength}
                      onChange={(e) => setSiteConfig({...siteConfig, maxMessageLength: parseInt(e.target.value)})}
                      className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-[var(--surface)] rounded-lg">
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">Enable Deep Research</p>
                      <p className="text-sm text-[var(--text-muted)]">Allow users to use deep research mode</p>
                    </div>
                    <button
                      onClick={() => setSiteConfig({...siteConfig, enableDeepResearch: !siteConfig.enableDeepResearch})}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${siteConfig.enableDeepResearch ? 'bg-[var(--accent)]' : 'bg-[var(--surface-border)]'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${siteConfig.enableDeepResearch ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-[var(--surface)] rounded-lg border border-red-500/20">
                    <div>
                      <p className="font-medium text-red-500">Maintenance Mode</p>
                      <p className="text-sm text-[var(--text-muted)]">Disable access for all users except admin</p>
                    </div>
                    <button
                      onClick={() => setSiteConfig({...siteConfig, maintenanceMode: !siteConfig.maintenanceMode})}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${siteConfig.maintenanceMode ? 'bg-red-500' : 'bg-[var(--surface-border)]'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${siteConfig.maintenanceMode ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  <button
                    onClick={saveSiteConfig}
                    disabled={loading}
                    className="w-full px-4 py-2 bg-[var(--accent)] text-[var(--bg)] rounded-lg hover:opacity-90 transition-opacity font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <RefreshCw size={18} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={18} />
                        Save Configuration
                      </>
                    )}
                  </button>

                  {saveSuccess && (
                    <p className="text-sm text-green-500 text-center">✓ Configuration saved successfully!</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl p-6">
                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">User Management</h2>
                <p className="text-[var(--text-secondary)]">User management features coming soon...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
