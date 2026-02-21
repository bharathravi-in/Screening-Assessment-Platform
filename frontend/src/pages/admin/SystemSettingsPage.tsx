import { useState, useEffect, useCallback } from 'react';
import {
  Save,
  Brain,
  Server,
  Shield,
  Mail,
  Zap,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { systemSettingsService, type SystemSettings } from '../../services/systemSettingsService';

type TabKey = 'ai' | 'platform' | 'security' | 'email' | 'ratelimit';

const TABS: { key: TabKey; label: string; icon: typeof Brain }[] = [
  { key: 'ai', label: 'AI Configuration', icon: Brain },
  { key: 'platform', label: 'Platform', icon: Server },
  { key: 'security', label: 'Security', icon: Shield },
  { key: 'email', label: 'Email / SMTP', icon: Mail },
  { key: 'ratelimit', label: 'Rate Limits', icon: Zap },
];

const PROVIDERS = ['openai', 'anthropic', 'gemini'] as const;
const PROVIDER_META = {
  openai: { label: 'OpenAI', color: '#10a37f', desc: 'GPT-4o, GPT-4o-mini, GPT-3.5-turbo' },
  anthropic: { label: 'Anthropic', color: '#d97706', desc: 'Claude 3.5 Sonnet / Haiku, Claude 3 Opus' },
  gemini: { label: 'Google Gemini', color: '#4285f4', desc: 'Gemini 1.5 Pro / Flash, Gemini 2.0 Flash' },
};

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--card-shadow)',
};

const inputBase: React.CSSProperties = {
  backgroundColor: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 14,
  outline: 'none',
  width: '100%',
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex-shrink-0 w-11 h-6 rounded-full relative transition-colors"
      style={{ backgroundColor: checked ? 'var(--accent)' : 'var(--border)' }}
    >
      <span
        className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform shadow"
        style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
      />
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export default function SystemSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('ai');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await systemSettingsService.get();
      setSettings(data);
    } catch {
      toast.error('Failed to load system settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await systemSettingsService.update(settings);
      setSettings(updated);
      toast.success('System settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    setSettings((s) => s ? { ...s, [key]: value } : s);
  };

  const setProvider = (
    provider: string,
    field: string,
    value: string | boolean | string[]
  ) => {
    setSettings((s) => {
      if (!s) return s;
      return {
        ...s,
        ai_providers_config: {
          ...s.ai_providers_config,
          [provider]: { ...s.ai_providers_config[provider], [field]: value },
        },
      };
    });
  };

  const toggleShowPassword = (key: string) => {
    setShowPasswords((p) => ({ ...p, [key]: !p[key] }));
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
        <Loader2 size={24} className="animate-spin mr-2" />
        Loading settings…
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            System Settings
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Platform-wide configuration — AI providers, security policy, email &amp; rate limits
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            title="Reload"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm text-white"
            style={{ backgroundColor: 'var(--accent)', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 mb-6 p-1 rounded-xl w-fit flex-wrap"
        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                backgroundColor: isActive ? 'var(--card-bg)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                boxShadow: isActive ? 'var(--card-shadow)' : 'none',
              }}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── AI Configuration ───────────────────────────────────────────────── */}
      {activeTab === 'ai' && (
        <div className="space-y-5">
          {/* Default Provider */}
          <div className="rounded-xl p-6" style={cardStyle}>
            <div className="flex items-center gap-2 mb-4">
              <Brain size={18} style={{ color: 'var(--accent)' }} />
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                Default AI Provider
              </h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {PROVIDERS.map((p) => {
                const meta = PROVIDER_META[p];
                const isDefault = settings.default_ai_provider === p;
                const cfg = settings.ai_providers_config[p];
                return (
                  <button
                    key={p}
                    onClick={() => set('default_ai_provider', p)}
                    className="p-4 rounded-xl text-left transition-all"
                    style={{
                      backgroundColor: isDefault
                        ? 'color-mix(in srgb, var(--accent) 10%, transparent)'
                        : 'var(--bg-secondary)',
                      border: `2px solid ${isDefault ? 'var(--accent)' : 'var(--border)'}`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                        style={{ backgroundColor: meta.color }}
                      >
                        {p.charAt(0).toUpperCase()}
                      </div>
                      {isDefault && <CheckCircle size={16} style={{ color: 'var(--accent)' }} />}
                    </div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {meta.label}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {cfg?.enabled ? '✓ Enabled' : '✗ Disabled'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Per-provider config */}
          {PROVIDERS.map((provider) => {
            const meta = PROVIDER_META[provider];
            const cfg = settings.ai_providers_config[provider] || {
              enabled: false, api_key: '', default_model: '', models: [],
            };
            const keyId = `apikey-${provider}`;
            return (
              <div key={provider} className="rounded-xl p-6" style={cardStyle}>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                      style={{ backgroundColor: meta.color }}
                    >
                      {provider.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {meta.label}
                      </h3>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {meta.desc}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {cfg.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <Toggle
                      checked={cfg.enabled}
                      onChange={(v) => setProvider(provider, 'enabled', v)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label="API Key" hint="Stored server-side. Enter new value to update.">
                    <div className="relative">
                      <input
                        type={showPasswords[keyId] ? 'text' : 'password'}
                        value={cfg.api_key}
                        onChange={(e) => setProvider(provider, 'api_key', e.target.value)}
                        placeholder="sk-..."
                        style={{ ...inputBase, paddingRight: 40 }}
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowPassword(keyId)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {showPasswords[keyId] ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </Field>
                  <Field label="Default Model">
                    <select
                      value={cfg.default_model}
                      onChange={(e) => setProvider(provider, 'default_model', e.target.value)}
                      style={{ ...inputBase }}
                    >
                      {(cfg.models || []).map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                {!cfg.api_key && cfg.enabled && (
                  <div
                    className="flex items-center gap-2 mt-4 p-3 rounded-lg"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--danger) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)' }}
                  >
                    <AlertCircle size={14} style={{ color: 'var(--danger)' }} />
                    <p className="text-xs" style={{ color: 'var(--danger)' }}>
                      Provider is enabled but no API key is set. Requests will fail.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Platform ───────────────────────────────────────────────────────── */}
      {activeTab === 'platform' && (
        <div className="space-y-5">
          {/* Maintenance */}
          <div className="rounded-xl p-6" style={cardStyle}>
            <div className="flex items-center gap-2 mb-5">
              <Server size={18} style={{ color: 'var(--accent)' }} />
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                Maintenance Mode
              </h2>
            </div>
            <div
              className="flex items-center justify-between p-4 rounded-lg"
              style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
            >
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Enable Maintenance Mode
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Non-super-admin users will see the maintenance message instead of the platform
                </p>
              </div>
              <Toggle
                checked={settings.maintenance_mode}
                onChange={(v) => set('maintenance_mode', v)}
              />
            </div>
            {settings.maintenance_mode && (
              <div className="mt-4">
                <Field label="Maintenance Message">
                  <textarea
                    rows={3}
                    value={settings.maintenance_message || ''}
                    onChange={(e) => set('maintenance_message', e.target.value)}
                    placeholder="We're performing scheduled maintenance. We'll be back shortly."
                    style={{ ...inputBase, resize: 'vertical' }}
                  />
                </Field>
              </div>
            )}
          </div>

          {/* Quotas */}
          <div className="rounded-xl p-6" style={cardStyle}>
            <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>
              Platform Quotas
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              <Field label="Max Organizations">
                <input
                  type="number" min={1}
                  value={settings.max_orgs}
                  onChange={(e) => set('max_orgs', Number(e.target.value))}
                  style={inputBase}
                />
              </Field>
              <Field label="Max Users per Org">
                <input
                  type="number" min={1}
                  value={settings.max_users_per_org}
                  onChange={(e) => set('max_users_per_org', Number(e.target.value))}
                  style={inputBase}
                />
              </Field>
              <Field label="Max Assessments per Org">
                <input
                  type="number" min={1}
                  value={settings.max_assessments_per_org}
                  onChange={(e) => set('max_assessments_per_org', Number(e.target.value))}
                  style={inputBase}
                />
              </Field>
              <Field label="Max Candidates per Assessment">
                <input
                  type="number" min={1}
                  value={settings.max_candidates_per_assessment}
                  onChange={(e) => set('max_candidates_per_assessment', Number(e.target.value))}
                  style={inputBase}
                />
              </Field>
            </div>
          </div>

          {/* Registration */}
          <div className="rounded-xl p-6" style={cardStyle}>
            <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>
              Registration
            </h2>
            <div
              className="flex items-center justify-between p-4 rounded-lg"
              style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
            >
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Allow Organization Self-Registration
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Let companies create their own organization accounts
                </p>
              </div>
              <Toggle
                checked={settings.allow_org_self_registration}
                onChange={(v) => set('allow_org_self_registration', v)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Security ───────────────────────────────────────────────────────── */}
      {activeTab === 'security' && (
        <div className="space-y-5">
          <div className="rounded-xl p-6" style={cardStyle}>
            <div className="flex items-center gap-2 mb-5">
              <Shield size={18} style={{ color: 'var(--accent)' }} />
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                Session &amp; Token Lifetime
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Access Token Expiry (minutes)" hint="How long a JWT access token is valid">
                <input
                  type="number" min={5}
                  value={settings.access_token_expire_minutes}
                  onChange={(e) => set('access_token_expire_minutes', Number(e.target.value))}
                  style={inputBase}
                />
              </Field>
              <Field label="Refresh Token Expiry (days)" hint="How long a session can stay active with refresh">
                <input
                  type="number" min={1}
                  value={settings.refresh_token_expire_days}
                  onChange={(e) => set('refresh_token_expire_days', Number(e.target.value))}
                  style={inputBase}
                />
              </Field>
            </div>
          </div>

          <div className="rounded-xl p-6" style={cardStyle}>
            <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>
              Password Policy
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Minimum Length">
                <input
                  type="number" min={6} max={32}
                  value={settings.password_min_length}
                  onChange={(e) => set('password_min_length', Number(e.target.value))}
                  style={inputBase}
                />
              </Field>
              <div className="space-y-3 mt-5">
                {[
                  { key: 'password_require_uppercase' as const, label: 'Require uppercase letter' },
                  { key: 'password_require_numbers' as const, label: 'Require number' },
                  { key: 'password_require_special' as const, label: 'Require special character' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{label}</span>
                    <Toggle checked={settings[key]} onChange={(v) => set(key, v)} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl p-6" style={cardStyle}>
            <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>
              Login Lockout
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Max Login Attempts" hint="Lock account after this many consecutive failures">
                <input
                  type="number" min={1} max={20}
                  value={settings.max_login_attempts}
                  onChange={(e) => set('max_login_attempts', Number(e.target.value))}
                  style={inputBase}
                />
              </Field>
              <Field label="Lockout Duration (minutes)">
                <input
                  type="number" min={1}
                  value={settings.lockout_duration_minutes}
                  onChange={(e) => set('lockout_duration_minutes', Number(e.target.value))}
                  style={inputBase}
                />
              </Field>
            </div>
          </div>
        </div>
      )}

      {/* ── Email / SMTP ───────────────────────────────────────────────────── */}
      {activeTab === 'email' && (
        <div className="rounded-xl p-6" style={cardStyle}>
          <div className="flex items-center gap-2 mb-5">
            <Mail size={18} style={{ color: 'var(--accent)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              SMTP Configuration
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="SMTP Host">
              <input
                type="text"
                value={settings.smtp_host || ''}
                onChange={(e) => set('smtp_host', e.target.value)}
                placeholder="smtp.sendgrid.net"
                style={inputBase}
              />
            </Field>
            <Field label="SMTP Port">
              <input
                type="number"
                value={settings.smtp_port}
                onChange={(e) => set('smtp_port', Number(e.target.value))}
                style={inputBase}
              />
            </Field>
            <Field label="Username">
              <input
                type="text"
                value={settings.smtp_username || ''}
                onChange={(e) => set('smtp_username', e.target.value)}
                placeholder="apikey"
                style={inputBase}
              />
            </Field>
            <Field label="Password">
              <div className="relative">
                <input
                  type={showPasswords['smtp'] ? 'text' : 'password'}
                  value={settings.smtp_password || ''}
                  onChange={(e) => set('smtp_password', e.target.value)}
                  placeholder="••••••••"
                  style={{ ...inputBase, paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => toggleShowPassword('smtp')}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {showPasswords['smtp'] ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>
            <Field label="From Address">
              <input
                type="email"
                value={settings.smtp_from_address || ''}
                onChange={(e) => set('smtp_from_address', e.target.value)}
                placeholder="noreply@yourdomain.com"
                style={inputBase}
              />
            </Field>
            <Field label="From Name">
              <input
                type="text"
                value={settings.smtp_from_name}
                onChange={(e) => set('smtp_from_name', e.target.value)}
                placeholder="Assessment Platform"
                style={inputBase}
              />
            </Field>
          </div>
          <div className="flex items-center justify-between mt-5 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Use TLS/STARTTLS</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Recommended for port 587</p>
            </div>
            <Toggle checked={settings.smtp_use_tls} onChange={(v) => set('smtp_use_tls', v)} />
          </div>
        </div>
      )}

      {/* ── Rate Limits ────────────────────────────────────────────────────── */}
      {activeTab === 'ratelimit' && (
        <div className="rounded-xl p-6" style={cardStyle}>
          <div className="flex items-center gap-2 mb-5">
            <Zap size={18} style={{ color: 'var(--accent)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Rate Limiting
            </h2>
          </div>
          <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
            Maximum requests allowed per minute per IP / session. Changes apply after backend restart.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="API Rate Limit (requests / minute)" hint="Applies to all authenticated API calls">
              <input
                type="number" min={10}
                value={settings.api_rate_limit_per_minute}
                onChange={(e) => set('api_rate_limit_per_minute', Number(e.target.value))}
                style={inputBase}
              />
            </Field>
            <Field label="Candidate Portal Rate Limit (requests / minute)" hint="Applied to test-taking endpoints">
              <input
                type="number" min={10}
                value={settings.candidate_rate_limit_per_minute}
                onChange={(e) => set('candidate_rate_limit_per_minute', Number(e.target.value))}
                style={inputBase}
              />
            </Field>
          </div>

          <div
            className="flex items-start gap-3 mt-6 p-4 rounded-xl"
            style={{ backgroundColor: 'color-mix(in srgb, var(--warning) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--warning) 25%, transparent)' }}
          >
            <AlertCircle size={15} style={{ color: 'var(--warning)', marginTop: 2 }} />
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Rate limiting enforcement is done at the application layer. For production, prefer
              configuring limits at your reverse proxy (nginx/Caddy) or API gateway level.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
