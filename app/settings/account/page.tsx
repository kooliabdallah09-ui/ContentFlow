'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/auth'
import Link from 'next/link'
import { showSuccess, showError } from '@/lib/notifications'

interface UserProfile {
  fullName: string
  email: string
}

export default function AccountSettingsPage() {
  const [profile, setProfile] = useState<UserProfile>({
    fullName: '',
    email: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    loadUserProfile()
  }, [])

  const loadUserProfile = async () => {
    try {
      const supabase = getSupabase()
      if (!supabase) return

      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        setProfile({
          fullName: userData.user.user_metadata?.full_name || '',
          email: userData.user.email || '',
        })
      }
    } catch (error) {
      console.error('Failed to load profile:', error)
      showError('Failed to load profile', 'Please refresh the page')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Not authenticated')

      const { error } = await supabase.auth.updateUser({
        data: { full_name: profile.fullName },
      })

      if (error) throw error
      showSuccess('Profile updated', 'Your name has been updated successfully')
    } catch (error) {
      showError('Update failed', error instanceof Error ? error.message : 'Please try again')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      showError('Passwords do not match', 'New password and confirmation must be the same')
      return
    }

    if (newPassword.length < 6) {
      showError('Password too short', 'Password must be at least 6 characters')
      return
    }

    setSaving(true)

    try {
      const supabase = getSupabase()
      if (!supabase) throw new Error('Not authenticated')

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      showSuccess('Password changed', 'Your password has been updated successfully')
    } catch (error) {
      showError('Failed to change password', error instanceof Error ? error.message : 'Please try again')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '4px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--ink-dim)', fontSize: '14px' }}>Loading account settings...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  return (
    <div className="content">
      <div className="page-head">
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px', overflowX: 'auto' }}>
          <a href="/settings/brand" style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--ink-dim)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Brand</a>
          <a href="/settings/account" style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--accent)', borderBottom: '2px solid var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Account</a>
          <a href="/settings/billing" style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--ink-dim)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Billing</a>
          <a href="/settings/integrations" style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--ink-dim)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Integrations</a>
        </div>
        <h1 className="page-title">Account <em>Settings</em></h1>
        <p className="page-sub">Manage your profile, email, and security preferences.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', maxWidth: '900px' }}>
        {/* Profile Settings */}
        <div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '18px' }}>
              Profile Information
            </h2>

            <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-row">
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={profile.fullName}
                  onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                  placeholder="Your full name"
                  className="input"
                  disabled={saving}
                />
              </div>

              <div className="form-row">
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="input"
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
                <p className="eyebrow" style={{ color: 'var(--ink-dim)', marginTop: '6px', fontSize: '11px' }}>
                  Email cannot be changed. Contact support if you need to update it.
                </p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary"
                style={{ marginTop: '12px', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>

        {/* Security Settings */}
        <div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '18px' }}>
              Change Password
            </h2>

            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-row">
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="input"
                  disabled={saving}
                />
              </div>

              <div className="form-row">
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  className="input"
                  disabled={saving}
                />
              </div>

              <button
                type="submit"
                disabled={saving || !newPassword || !confirmPassword}
                className="btn btn-primary"
                style={{ marginTop: '12px', opacity: saving || !newPassword || !confirmPassword ? 0.6 : 1 }}
              >
                {saving ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div style={{ marginTop: '48px', padding: '24px', background: 'rgba(220, 38, 38, 0.1)', border: '1px solid var(--danger)', borderRadius: 'var(--r-lg)', maxWidth: '900px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--danger)', marginBottom: '12px' }}>
          Danger Zone
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--ink-dim)', marginBottom: '16px', lineHeight: 1.5 }}>
          These actions cannot be undone. Please be careful.
        </p>
        <button
          className="btn"
          style={{
            background: 'var(--danger)',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
          }}
          onClick={() => {
            if (confirm('Are you sure you want to delete your account? This cannot be undone.')) {
              showError('Not implemented', 'Account deletion is not yet available. Please contact support.')
            }
          }}
        >
          Delete Account
        </button>
      </div>
    </div>
  )
}
