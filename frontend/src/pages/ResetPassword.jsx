import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import client from '../api/client'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      await client.post(`/users/reset-password?token=${token}&new_password=${encodeURIComponent(password)}`)
      setSuccess(true)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Invalid or expired reset link')
    } finally {
      setLoading(false)
    }
  }

  if (!token) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 w-full max-w-sm p-8 text-center">
        <p className="text-red-600 text-sm">Invalid reset link.</p>
        <button onClick={() => navigate('/login')} className="mt-4 text-sm text-gray-500 hover:text-gray-700">Back to sign in</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 w-full max-w-sm p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Tekton</h1>
          <p className="text-sm text-gray-500 mt-1">Set your new password</p>
        </div>

        {success ? (
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-gray-600 mb-4">Password reset successfully.</p>
            <button onClick={() => navigate('/login')}
              className="w-full bg-gray-900 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-700">
              Sign in
            </button>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">{error}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                  placeholder="••••••••" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                  placeholder="••••••••" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-gray-900 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}