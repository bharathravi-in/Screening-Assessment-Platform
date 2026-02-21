import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Save,
  Palette,
  Shield,
  ClipboardList,
  Bell,
  Globe,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { orgService, type OrgItem } from '../../services/orgService';
import { useAuthStore } from '../../store/authStore';

type TabKey = 'branding' | 'proctoring' | 'assessment' | 'notifications';

const TABS: { key: TabKey; label: string; icon: typeof Palette }[] = [
  { key: 'branding', label: 'Branding', icon: Palette },
  { key: 'proctoring', label: 'Proctoring', icon: Shield },
  { key: 'assessment', label: 'Assessment Defaults', icon: ClipboardList },
  { key: 'notifications', label: 'Notifications', icon: Bell },
];

const THEME_FIELDS: { key: string; label: string; type: 'color' | 'text' | 'url' }[] = [
  { key: 'primary_color', label: 'Primary Color', type: 'color' },
  { key: 'secondary_color', label: 'Secondary Color', type: 'color' },
  { key: 'accent_color', label: 'Accent Color', type: 'color' },
  { key: 'font_family', label: 'Font Family', type: 'text' },
  { key: 'logo_url', label: 'Logo URL', type: 'url' },
  { key: 'favicon_url', label: 'Favicon URL', type: 'url' },
  { key: 'login_background_url', label: 'Login Background URL', type: 'url' },
  { key: 'company_name', label: 'Company Name', type: 'text' },
  { key: 'email_from_name', label: 'Email From Name', type: 'text' },
  { key: 'custom_css', label: 'Custom CSS', type: 'text' },
];

const PROCTORING_FLAGS: { key: string; label: string; description: string }[] = [
  { key: 'copy_paste_disabled', label: 'Disable Copy/Paste', description: 'Prevent candidates from copying or pasting text during the test.' },
  { key: 'tab_switch_detection', label: 'Detect Tab Switching', description: 'Record violations when candidates switch browser tabs or minimize the window.' },
  { key: 'fullscreen_enforced', label: 'Enforce Fullscreen', description: 'Require candidates to stay in fullscreen mode.' },
  { key: 'right_click_disabled', label: 'Disable Right-Click', description: 'Prevent right-click context menus.' },
  { key: 'keyboard_shortcuts_restricted', label: 'Restrict Keyboard Shortcuts', description: 'Block common keyboard shortcuts like PrintScreen, F12, and Ctrl+C.' },
];

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

interface SettingsState {
  theme: Record<string, string>;
  proctoring: Record<string, boolean>;
  maxViolations: number;
  autoTerminate: boolean;
  assessmentDefaults: {
    default_time_limit_minutes: number;
    default_passing_score: number;
    randomize_questions: boolean;
    show_results_immediately: boolean;
    allow_backward_navigation: boolean;
    instructions_template: string;
  };
  notificationConfig: {
    notify_on_completion: boolean;
    notify_on_violation: boolean;
    alert_emails: string[];
    completion_email_subject: string;
  };
}

const DEFAULT_ASSESSMENT = {
  default_time_limit_minutes: 60,
  default_passing_score: 70,
  randomize_questions: false,
  show_results_immediately: true,
  allow_backward_navigation: true,
  instructions_template: '',
};

const DEFAULT_NOTIFICATIONS = {
  notify_on_completion: true,
  notify_on_violation: true,
  alert_emails: [] as string[],
  completion_email_subject: 'Assessment Completed',
};

export default function OrgSettingsPage() {
  const { orgId: orgIdParam } = useParams<{ orgId: string }>();
  // Fall back to auth store's org when navigating via /admin/org-settings (no URL param)
  const authOrgId = useAuthStore((s) => s.organizationId);
  const orgId = orgIdParam ?? authOrgId ?? '';

  const [activeTab, setActiveTab] = useState<TabKey>('branding');
  const [org, setOrg] = useState<OrgItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [settings, setSettings] = useState<SettingsState>({
    theme: {},
    proctoring: {
      copy_paste_disabled: true,
      tab_switch_detection: true,
      fullscreen_enforced: true,
      right_click_disabled: true,
      keyboard_shortcuts_restricted: true,
    },
    maxViolations: 3,
    autoTerminate: true,
    assessmentDefaults: DEFAULT_ASSESSMENT,
    notificationConfig: DEFAULT_NOTIFICATIONS,
  });

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [orgData, settingsData] = await Promise.all([
        orgService.get(orgId),
        orgService.getSettings(orgId),
      ]);
      setOrg(orgData);
      setSettings({
        theme: (settingsData.theme_config as Record<string, string>) || {},
        proctoring: (settingsData.proctoring_defaults as Record<string, boolean>) || {},
        maxViolations: settingsData.max_violation_warnings ?? 3,
        autoTerminate: settingsData.auto_terminate_on_violations ?? true,
        assessmentDefaults: {
          ...DEFAULT_ASSESSMENT,
          ...(settingsData.assessment_defaults as typeof DEFAULT_ASSESSMENT || {}),
        },
        notificationConfig: {
          ...DEFAULT_NOTIFICATIONS,
          ...(settingsData.notification_config as typeof DEFAULT_NOTIFICATIONS || {}),
        },
      });
    } catch {
      toast.error('Failed to load organization settings');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      await orgService.updateSettings(orgId, {
        theme_config: settings.theme,
        proctoring_defaults: settings.proctoring,
        max_violation_warnings: settings.maxViolations,
        auto_terminate_on_violations: settings.autoTerminate,
        assessment_defaults: settings.assessmentDefaults as Record<string, unknown>,
        notification_config: settings.notificationConfig as Record<string, unknown>,
      });
      toast.success('Settings saved successfully');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const setThemeField = (key: string, value: string) => {
    setSettings((s) => ({ ...s, theme: { ...s.theme, [key]: value } }));
  };
  const setProctoringFlag = (key: string, value: boolean) => {
    setSettings((s) => ({ ...s, proctoring: { ...s.proctoring, [key]: value } }));
  };
  const setAssessment = <K extends keyof SettingsState['assessmentDefaults']>(
    key: K, value: SettingsState['assessmentDefaults'][K]
  ) => {
    setSettings((s) => ({ ...s, assessmentDefaults: { ...s.assessmentDefaults, [key]: value } }));
  };
  const setNotification = <K extends keyof SettingsState['notificationConfig']>(
    key: K, value: SettingsState['notificationConfig'][K]
  ) => {
    setSettings((s) => ({ ...s, notificationConfig: { ...s.notificationConfig, [key]: value } }));
  };
  const addAlertEmail = () => {
    const e = newEmail.trim();
    if (!e || settings.notificationConfig.alert_emails.includes(e)) return;
    setNotification('alert_emails', [...settings.notificationConfig.alert_emails, e]);
    setNewEmail('');
  };
  const removeAlertEmail = (email: string) => {
    setNotification('alert_emails', settings.notificationConfig.alert_emails.filter((x) => x !== email));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
        <Loader2 size={24} className="animate-spin mr-2" />
        Loading settings…
      </div>
    );
  }

  if (!org) {
    return (
      <div className="text-center py-20" style={{ color: 'var(--danger)' }}>
        <AlertCircle size={32} className="mx-auto mb-2" />
        Organization not found
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {org.name} — Settings
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Manage branding, proctoring defaults, assessment settings and notifications
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            title="Reload"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm text-white"
            style={{ backgroundColor: 'var(--accent)', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving…' : 'Save Settings'}
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

      {/* ── Branding ─────────────────────────────────────────────────────── */}
      {activeTab === 'branding' && (
        <div className="space-y-6">
          <div className="rounded-xl p-6" style={cardStyle}>
            <div className="flex items-center gap-2 mb-5">
              <Palette size={18} style={{ color: 'var(--accent)' }} />
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                Theme &amp; Identity
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {THEME_FIELDS.map((field) => (
                <div key={field.key}>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {field.label}
                  </label>
                  {field.type === 'color' ? (
                    <div className="flex gap-3 items-center">
                      <input
                        type="color"
                        value={settings.theme[field.key] || '#3b82f6'}
                        onChange={(e) => setThemeField(field.key, e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer"
                        style={{ border: '1px solid var(--border)', padding: 2 }}
                      />
                      <input
                        type="text"
                        value={settings.theme[field.key] || ''}
                        onChange={(e) => setThemeField(field.key, e.target.value)}
                        placeholder="#3b82f6"
                        style={{ ...inputBase, flex: 1 }}
                      />
                    </div>
                  ) : field.key === 'custom_css' ? (
                    <textarea
                      rows={4}
                      value={settings.theme[field.key] || ''}
                      onChange={(e) => setThemeField(field.key, e.target.value)}
                      placeholder="/* custom CSS */"
                      style={{ ...inputBase, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                    />
                  ) : (
                    <input
                      type={field.type === 'url' ? 'url' : 'text'}
                      value={settings.theme[field.key] || ''}
                      onChange={(e) => setThemeField(field.key, e.target.value)}
                      placeholder={field.type === 'url' ? 'https://...' : ''}
                      style={inputBase}
                    />
                  )}
                </div>
              ))}
            </div>

            {settings.theme.logo_url && (
              <div className="mt-5 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
                <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                  Logo Preview
                </p>
                <div
                  className="inline-flex items-center justify-center p-4 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                >
                  <img
                    src={settings.theme.logo_url}
                    alt="Organization logo"
                    className="max-h-16 max-w-48 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              </div>
            )}
          </div>

          <div
            className="flex items-start gap-3 p-4 rounded-xl"
            style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)' }}
          >
            <Globe size={16} style={{ color: 'var(--accent)', marginTop: 2, flexShrink: 0 }} />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
                Public Branding URL
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                Candidate-facing pages load your branding from{' '}
                <code className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                  /api/v1/organizations/branding/{org.slug}
                </code>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Proctoring ───────────────────────────────────────────────────── */}
      {activeTab === 'proctoring' && (
        <div className="rounded-xl p-6 space-y-5" style={cardStyle}>
          <div className="flex items-center gap-2 mb-2">
            <Shield size={18} style={{ color: 'var(--accent)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Proctoring Defaults
            </h2>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Applied to new assessments by default. Individual assessments can override these.
          </p>
          <div className="space-y-4">
            {PROCTORING_FLAGS.map((flag) => (
              <div
                key={flag.key}
                className="flex items-start gap-4 p-4 rounded-lg"
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
              >
                <Toggle
                  checked={!!settings.proctoring[flag.key]}
                  onChange={(v) => setProctoringFlag(flag.key, v)}
                />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {flag.label}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {flag.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-5" style={{ borderTop: '1px solid var(--border)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Violation Limits
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Max Violations Before Warning
                </label>
                <input
                  type="number" min={1} max={20}
                  value={settings.maxViolations}
                  onChange={(e) => setSettings((s) => ({ ...s, maxViolations: Number(e.target.value) }))}
                  style={inputBase}
                />
              </div>
              <div className="flex items-center gap-4 pt-5">
                <Toggle
                  checked={settings.autoTerminate}
                  onChange={(v) => setSettings((s) => ({ ...s, autoTerminate: v }))}
                />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    Auto-terminate on max violations
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Automatically end the session when limit is reached
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Assessment Defaults ───────────────────────────────────────────── */}
      {activeTab === 'assessment' && (
        <div className="rounded-xl p-6 space-y-5" style={cardStyle}>
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList size={18} style={{ color: 'var(--accent)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Assessment Defaults
            </h2>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            These values are pre-filled when creating a new assessment. HR managers can override them per assessment.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Default Time Limit (minutes)
              </label>
              <input
                type="number" min={5}
                value={settings.assessmentDefaults.default_time_limit_minutes}
                onChange={(e) => setAssessment('default_time_limit_minutes', Number(e.target.value))}
                style={inputBase}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Default Passing Score (%)
              </label>
              <input
                type="number" min={1} max={100}
                value={settings.assessmentDefaults.default_passing_score}
                onChange={(e) => setAssessment('default_passing_score', Number(e.target.value))}
                style={inputBase}
              />
            </div>
          </div>
          <div className="space-y-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            {[
              { key: 'randomize_questions' as const, label: 'Randomize question order', desc: 'Shuffle questions for each candidate' },
              { key: 'show_results_immediately' as const, label: 'Show results immediately after submission', desc: 'Candidates see their score right after completing the test' },
              { key: 'allow_backward_navigation' as const, label: 'Allow backward navigation', desc: 'Candidates can go back to previous questions' },
            ].map(({ key, label, desc }) => (
              <div
                key={key}
                className="flex items-start gap-4 p-4 rounded-lg"
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
              >
                <Toggle
                  checked={settings.assessmentDefaults[key]}
                  onChange={(v) => setAssessment(key, v)}
                />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Default Instructions Template
            </label>
            <textarea
              rows={5}
              value={settings.assessmentDefaults.instructions_template}
              onChange={(e) => setAssessment('instructions_template', e.target.value)}
              placeholder="e.g. Read all questions carefully. You have {time_limit} minutes to complete this assessment..."
              style={{ ...inputBase, resize: 'vertical' }}
            />
          </div>
        </div>
      )}

      {/* ── Notifications ────────────────────────────────────────────────── */}
      {activeTab === 'notifications' && (
        <div className="rounded-xl p-6 space-y-5" style={cardStyle}>
          <div className="flex items-center gap-2 mb-2">
            <Bell size={18} style={{ color: 'var(--accent)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Notification Settings
            </h2>
          </div>

          <div className="space-y-4">
            {[
              { key: 'notify_on_completion' as const, label: 'Notify on assessment completion', desc: 'Send email to alert addresses when a candidate completes the test' },
              { key: 'notify_on_violation' as const, label: 'Notify on proctoring violations', desc: 'Send alert when a candidate exceeds the violation threshold' },
            ].map(({ key, label, desc }) => (
              <div
                key={key}
                className="flex items-start gap-4 p-4 rounded-lg"
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
              >
                <Toggle
                  checked={settings.notificationConfig[key]}
                  onChange={(v) => setNotification(key, v)}
                />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-5" style={{ borderTop: '1px solid var(--border)' }}>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Alert Email Subject
            </label>
            <input
              type="text"
              value={settings.notificationConfig.completion_email_subject}
              onChange={(e) => setNotification('completion_email_subject', e.target.value)}
              placeholder="Assessment Completed"
              style={inputBase}
            />
          </div>

          <div className="pt-5" style={{ borderTop: '1px solid var(--border)' }}>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Alert Email Addresses
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addAlertEmail()}
                placeholder="hr@company.com"
                style={{ ...inputBase, flex: 1 }}
              />
              <button
                onClick={addAlertEmail}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ backgroundColor: 'var(--accent)', whiteSpace: 'nowrap' }}
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {settings.notificationConfig.alert_emails.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs"
                  style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                >
                  {email}
                  <button
                    onClick={() => removeAlertEmail(email)}
                    style={{ color: 'var(--danger)' }}
                    className="ml-0.5 leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
              {settings.notificationConfig.alert_emails.length === 0 && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  No alert emails configured. Notifications will not be sent.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

