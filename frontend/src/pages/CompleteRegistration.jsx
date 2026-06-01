import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import client from '../api/client'

export default function CompleteRegistration() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    password: '',
    confirm_password: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) { setFetching(false); return }
    const fetchUserByToken = async () => {
      try {
        const { data } = await client.get(`/users/registration-info?token=${token}`)
        setFormData(prev => ({
          ...prev,
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          middle_name: data.middle_name || '',
        }))
      } catch (err) {
        setError('Invalid or expired registration link')
      } finally {
        setFetching(false)
      }
    }
    fetchUserByToken()
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match')
      return
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      await client.post('/users/complete-registration', {
        token,
        password: formData.password,
        first_name: formData.first_name,
        last_name: formData.last_name,
        middle_name: formData.middle_name || null,
      })
      setSuccess(true)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Invalid or expired link')
    } finally {
      setLoading(false)
    }
  }

  const set = (field) => (e) => setFormData(p => ({ ...p, [field]: e.target.value }))

  if (!token) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 w-full max-w-sm p-8 text-center">
        <p className="text-red-600 text-sm">Invalid registration link.</p>
        <button onClick={() => navigate('/login')} className="mt-4 text-sm text-gray-500 hover:text-gray-700">
          Back to sign in
        </button>
      </div>
    </div>
  )

  if (fetching) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-sm text-gray-400">Loading...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 w-full max-w-sm p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Tekton</h1>
          <p className="text-sm text-gray-500 mt-1">Complete your registration</p>
        </div>

        {success ? (
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-gray-600 mb-4">Registration complete! You can now sign in.</p>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">First Name *</label>
                  <input value={formData.first_name} onChange={set('first_name')} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Last Name *</label>
                  <input value={formData.last_name} onChange={set('last_name')} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Middle Name</label>
                <input value={formData.middle_name} onChange={set('middle_name')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Password *</label>
                <input type="password" value={formData.password} onChange={set('password')} required
                  placeholder="Minimum 8 characters"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Confirm Password *</label>
                <input type="password" value={formData.confirm_password} onChange={set('confirm_password')} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-gray-900 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
                {loading ? 'Completing...' : 'Complete Registration'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}