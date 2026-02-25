import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import ThemeToggle from '../../components/common/ThemeToggle';
import { useBranding } from '../../hooks/useBranding';
import { useBrandingStore } from '../../store/brandingStore';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);

  // Auto-redirect if already logged in
  useEffect(() => {
    if (isAuthenticated && role) {
      if (role === 'super_admin' || role === 'admin') navigate('/admin');
      else if (role === 'hr') navigate('/hr');
      else if (role === 'tech') navigate('/tech');
      else navigate('/');
    }
  }, [isAuthenticated, role, navigate]);

  // Load org branding from ?org= query param
  useBranding();
  const orgName = useBrandingStore((s) => s.organizationName);
  const logoUrl = useBrandingStore((s) => s.logoUrl);
  const bgUrl = useBrandingStore((s) => s.theme['login_background_url']);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ email, password });
      const role = useAuthStore.getState().role;
      if (role === 'super_admin' || role === 'admin') navigate('/admin');
      else if (role === 'hr') navigate('/hr');
      else if (role === 'tech') navigate('/tech');
      else navigate('/');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setError(detail);
      } else if (Array.isArray(detail)) {
        setError(detail.map((d: any) => d.msg || JSON.stringify(d)).join(', '));
      } else {
        setError('Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        backgroundImage: bgUrl ? `url(${bgUrl})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {bgUrl && (
        <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} />
      )}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div
        className="w-full max-w-md rounded-xl p-8 shadow-lg relative z-10"
        style={{
          backgroundColor: 'var(--card-bg)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <div className="text-center mb-8">
          {logoUrl && (
            <img
              src={logoUrl}
              alt={orgName || 'Organization logo'}
              className="h-12 mx-auto mb-4 object-contain"
            />
          )}
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {orgName || 'Assessment Platform'}
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Sign in to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div
              className="p-3 rounded-lg text-sm"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--danger)',
                border: '1px solid var(--danger)',
              }}
            >
              {error}
            </div>
          )}

          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
              placeholder="admin@assessment.local"
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
              placeholder="Enter password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-white font-medium text-sm transition-colors disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div
          className="mt-6 text-center text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          Demo: admin@assessment.local / admin123
        </div>
      </div>
    </div>
  );
}
