'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/auth'
import { Settings, Bell, Lock, User, Trash2, LogOut, Briefcase, ArrowRight } from 'lucide-react'
import { showSuccess, showError } from '@/lib/notifications'
import { useRouter } from 'next/navigation'

interface UserSettings {
  email: string
  fullName: string
  notifications_enabled: boolean
  auto_save_enabled: boolean
  theme: 'dark' | 'light'
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>({
    email: '',
    fullName: '',
    notifications_enabled: true,
    auto_save_enabled: true,
    theme: 'dark',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const supabase = getSupabase()
        if (!supabase) {
          setLoading(false)
          return
        }

        const { data: userData } = await supabase.auth.getUser()
        if (userData.user) {
          setSettings({
            email: userData.user.email || '',
            fullName: userData.user.user_metadata?.full_name || '',
            notifications_enabled: true,
            auto_save_enabled: true,
            theme: 'dark',
          })
        }
      } catch (err) {
        console.error('Failed to load settings:', err)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const supabase = getSupabase()
      if (!supabase) return

      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return

      // Update user metadata
      await supabase.auth.updateUser({
        data: { full_name: settings.fullName },
      })

      // Save preferences to localStorage
      localStorage.setItem(
        'userPreferences',
        JSON.stringify({
          notifications_enabled: settings.notifications_enabled,
          auto_save_enabled: settings.auto_save_enabled,
          theme: settings.theme,
        })
      )

      showSuccess('Settings saved successfully')
    } catch (err) {
      console.error('Failed to save settings:', err)
      showError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    const supabase = getSupabase()
    if (!supabase) return

    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return
    }

    try {
      const supabase = getSupabase()
      if (!supabase) return

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session?.access_token) return

      const response = await fetch('/api/user/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      })

      if (response.ok) {
        await supabase.auth.signOut()
        showSuccess('Account deleted successfully')
        router.push('/auth/login')
      } else {
        showError('Failed to delete account')
      }
    } catch (err) {
      console.error('Failed to delete account:', err)
      showError('Failed to delete account')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-white/60">Loading settings...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="w-6 h-6 text-cyan-400" />
            <h1 className="text-4xl font-black">Settings</h1>
          </div>
          <p className="text-white/60">Manage your account and preferences</p>
        </div>

        {/* Brand Settings Quick Link */}
        <div className="mb-8">
          <Link
            href="/settings/brand"
            className="block bg-gradient-to-r from-cyan-600/20 to-cyan-600/10 border border-cyan-500/30 rounded-lg p-6 hover:from-cyan-600/30 hover:to-cyan-600/20 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">Brand Profile</h3>
                  <p className="text-sm text-white/60">Set up your company name, description, and brand voice for AI-powered content generation</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-cyan-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* Account Section */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <User className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl font-semibold">Account</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-2">Email Address</label>
                <input
                  type="email"
                  value={settings.email}
                  disabled
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">Full Name</label>
                <input
                  type="text"
                  value={settings.fullName}
                  onChange={(e) => setSettings({ ...settings, fullName: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>
          </div>

          {/* Preferences Section */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <Bell className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl font-semibold">Preferences</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Notifications</p>
                  <p className="text-sm text-white/60">Receive updates about your content</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications_enabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notifications_enabled: e.target.checked,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-Save</p>
                  <p className="text-sm text-white/60">Automatically save form inputs</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.auto_save_enabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        auto_save_enabled: e.target.checked,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Security Section */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <Lock className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl font-semibold">Security</h2>
            </div>

            <div className="space-y-3">
              <button className="w-full px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-left font-medium">
                Change Password
              </button>
              <button className="w-full px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-left font-medium">
                Two-Factor Authentication
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-300 mb-4">Danger Zone</h2>

            <div className="space-y-3">
              <button
                onClick={handleLogout}
                className="w-full px-4 py-3 rounded-lg bg-orange-900/30 hover:bg-orange-900/50 border border-orange-700/50 text-orange-200 font-medium transition-colors flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>

              <button
                onClick={handleDeleteAccount}
                className="w-full px-4 py-3 rounded-lg bg-red-900/30 hover:bg-red-900/50 border border-red-700/50 text-red-200 font-medium transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Account
              </button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-8 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
