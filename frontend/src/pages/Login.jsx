import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import client from '../api/client'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('username', email)
      params.append('password', password)
      const { data: tokenData } = await client.post('/auth/login', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      })
      localStorage.setItem('token', tokenData.access_token)
      const { data: userData } = await client.get('/auth/me')
      login(tokenData.access_token, userData)
      navigate('/dashboard')
    } catch (err) {
      setError('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setForgotLoading(true)
    try {
      await client.post(`/users/forgot-password?email=${encodeURIComponent(forgotEmail)}`)
      setForgotSent(true)
    } catch (err) {
      setForgotSent(true) // Still show success to avoid email enumeration
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 w-full max-w-sm p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Tekton</h1>
          <p className="text-sm text-gray-500 mt-1">
            {showForgot ? 'Reset your password' : 'Sign in to your account'}
          </p>
        </div>

        {/* Login Form */}
        {!showForgot && (
          <>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                  placeholder="you@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                  placeholder="••••••••" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-gray-900 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50">
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
            <button onClick={() => { setShowForgot(true); setError('') }}
              className="mt-4 w-full text-center text-sm text-gray-500 hover:text-gray-700">
              Forgot your password?
            </button>
          </>
        )}

        {/* Forgot Password Form */}
        {showForgot && !forgotSent && (
          <>
            <p className="text-sm text-gray-500 mb-4">
              Enter your email and we'll send you a link to reset your password.
            </p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                  placeholder="you@example.com" />
              </div>
              <button type="submit" disabled={forgotLoading}
                className="w-full bg-gray-900 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50">
                {forgotLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
            <button onClick={() => setShowForgot(false)}
              className="mt-4 w-full text-center text-sm text-gray-500 hover:text-gray-700">
              Back to sign in
            </button>
          </>
        )}

        {/* Success State */}
        {showForgot && forgotSent && (
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              If that email exists in our system, a reset link has been sent.
            </p>
            <button onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail('') }}
              className="text-sm text-gray-500 hover:text-gray-700">
              Back to sign in
            </button>
          </div>
        )}
      </div>
    </div>
  )
}