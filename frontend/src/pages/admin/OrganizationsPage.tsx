import { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, Edit2, Settings, Loader2, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { orgService, type OrgItem, type OrgSettings } from '../../services/orgService';

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

const THEME_KEYS = [
  { key: 'accent', label: 'Accent' },
  { key: 'success', label: 'Success' },
  { key: 'danger', label: 'Danger' },
  { key: 'warning', label: 'Warning' },
  { key: 'sidebar-bg', label: 'Sidebar Background' },
];

const PROCTORING_KEYS = [
  { key: 'copy_paste_disabled', label: 'Disable Copy/Paste' },
  { key: 'tab_switch_detection', label: 'Tab Switch Detection' },
  { key: 'fullscreen_enforced', label: 'Enforce Fullscreen' },
  { key: 'right_click_disabled', label: 'Disable Right Click' },
  { key: 'keyboard_shortcuts_restricted', label: 'Restrict Keyboard Shortcuts' },
];

const DEFAULT_THEME: Record<string, string> = {
  accent: '#3b82f6',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  'sidebar-bg': '#1e293b',
};


export default function OrganizationsPage() {
  // ---- Organization list state ----
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [loading, setLoading] = useState(true);

  // ---- Create / Edit modal state ----
  const [showModal, setShowModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<OrgItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formLogo, setFormLogo] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // ---- Settings panel state ----
  const [settingsOrgId, setSettingsOrgId] = useState<string | null>(null);
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // ---- Theme form state ----
  const [themeAccent, setThemeAccent] = useState(DEFAULT_THEME.accent);
  const [themeSuccess, setThemeSuccess] = useState(DEFAULT_THEME.success);
  const [themeDanger, setThemeDanger] = useState(DEFAULT_THEME.danger);
  const [themeWarning, setThemeWarning] = useState(DEFAULT_THEME.warning);
  const [themeSidebarBg, setThemeSidebarBg] = useState(DEFAULT_THEME['sidebar-bg']);

  // ---- Proctoring form state ----
  const [procCopyPaste, setProcCopyPaste] = useState(false);
  const [procTabSwitch, setProcTabSwitch] = useState(false);
  const [procFullscreen, setProcFullscreen] = useState(false);
  const [procRightClick, setProcRightClick] = useState(false);
  const [procKeyboardShortcuts, setProcKeyboardShortcuts] = useState(false);

  // ---- Other settings state ----
  const [maxViolationWarnings, setMaxViolationWarnings] = useState(3);
  const [autoTerminate, setAutoTerminate] = useState(false);
  const [aiProviders, setAiProviders] = useState<string[]>([]);
  const [aiProviderInput, setAiProviderInput] = useState('');

  // ---- Fetch organizations on mount ----
  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await orgService.list();
      setOrgs(res.organizations);
    } catch {
      toast.error('Failed to load organizations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  // ---- Fetch settings when settingsOrgId changes ----
  useEffect(() => {
    if (!settingsOrgId) {
      setSettings(null);
      return;
    }

    let cancelled = false;
    const fetchSettings = async () => {
      setSettingsLoading(true);
      try {
        const data = await orgService.getSettings(settingsOrgId);
        if (cancelled) return;
        setSettings(data);

        // Populate theme form
        const theme = data.theme_config || {};
        setThemeAccent(theme.accent || DEFAULT_THEME.accent);
        setThemeSuccess(theme.success || DEFAULT_THEME.success);
        setThemeDanger(theme.danger || DEFAULT_THEME.danger);
        setThemeWarning(theme.warning || DEFAULT_THEME.warning);
        setThemeSidebarBg(theme['sidebar-bg'] || DEFAULT_THEME['sidebar-bg']);

        // Populate proctoring form
        const proc = data.proctoring_defaults || {};
        setProcCopyPaste(proc.copy_paste_disabled ?? false);
        setProcTabSwitch(proc.tab_switch_detection ?? false);
        setProcFullscreen(proc.fullscreen_enforced ?? false);
        setProcRightClick(proc.right_click_disabled ?? false);
        setProcKeyboardShortcuts(proc.keyboard_shortcuts_restricted ?? false);

        // Populate other settings
        setMaxViolationWarnings(data.max_violation_warnings ?? 3);
        setAutoTerminate(data.auto_terminate_on_violations ?? false);
        setAiProviders(data.allowed_ai_providers ?? []);
        setAiProviderInput('');
      } catch {
        if (!cancelled) {
          toast.error('Failed to load organization settings');
        }
      } finally {
        if (!cancelled) {
          setSettingsLoading(false);
        }
      }
    };

    fetchSettings();
    return () => {
      cancelled = true;
    };
  }, [settingsOrgId]);

  // ---- Modal helpers ----
  const openCreateModal = () => {
    setEditingOrg(null);
    setFormName('');
    setFormSlug('');
    setFormLogo('');
    setFormActive(true);
    setShowModal(true);
  };

  const openEditModal = (org: OrgItem) => {
    setEditingOrg(org);
    setFormName(org.name);
    setFormSlug(org.slug);
    setFormLogo(org.logo_url || '');
    setFormActive(org.is_active);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingOrg(null);
  };

  const handleNameChange = (value: string) => {
    setFormName(value);
    if (!editingOrg) {
      setFormSlug(toKebabCase(value));
    }
  };

  const handleSubmit = async () => {
    if (!formName.trim()) {
      toast.error('Organization name is required');
      return;
    }
    if (!formSlug.trim()) {
      toast.error('Organization slug is required');
      return;
    }

    setSaving(true);
    try {
      if (editingOrg) {
        await orgService.update(editingOrg.id, {
          name: formName.trim(),
          logo_url: formLogo.trim() || undefined,
          is_active: formActive,
        });
        toast.success('Organization updated successfully');
      } else {
        await orgService.create({
          name: formName.trim(),
          slug: formSlug.trim(),
          logo_url: formLogo.trim() || undefined,
        });
        toast.success('Organization created successfully');
      }
      closeModal();
      fetchOrgs();
    } catch {
      toast.error(editingOrg ? 'Failed to update organization' : 'Failed to create organization');
    } finally {
      setSaving(false);
    }
  };

  // ---- Settings helpers ----
  const handleSettingsToggle = (orgId: string) => {
    if (settingsOrgId === orgId) {
      setSettingsOrgId(null);
    } else {
      setSettingsOrgId(orgId);
    }
  };

  const handleAddAiProvider = () => {
    const value = aiProviderInput.trim();
    if (!value) return;
    if (aiProviders.includes(value)) {
      toast.error('Provider already added');
      return;
    }
    setAiProviders((prev) => [...prev, value]);
    setAiProviderInput('');
  };

  const handleRemoveAiProvider = (provider: string) => {
    setAiProviders((prev) => prev.filter((p) => p !== provider));
  };

  const handleAiProviderKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddAiProvider();
    }
  };

  const handleSaveSettings = async () => {
    if (!settingsOrgId) return;

    setSettingsSaving(true);
    try {
      const updatedSettings = await orgService.updateSettings(settingsOrgId, {
        theme_config: {
          accent: themeAccent,
          success: themeSuccess,
          danger: themeDanger,
          warning: themeWarning,
          'sidebar-bg': themeSidebarBg,
        },
        proctoring_defaults: {
          copy_paste_disabled: procCopyPaste,
          tab_switch_detection: procTabSwitch,
          fullscreen_enforced: procFullscreen,
          right_click_disabled: procRightClick,
          keyboard_shortcuts_restricted: procKeyboardShortcuts,
        },
        max_violation_warnings: maxViolationWarnings,
        auto_terminate_on_violations: autoTerminate,
        allowed_ai_providers: aiProviders,
      });
      setSettings(updatedSettings);
      toast.success('Settings saved successfully');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSettingsSaving(false);
    }
  };

  // ---- Theme state helpers for mapping ----
  const getThemeValue = (key: string): string => {
    switch (key) {
      case 'accent': return themeAccent;
      case 'success': return themeSuccess;
      case 'danger': return themeDanger;
      case 'warning': return themeWarning;
      case 'sidebar-bg': return themeSidebarBg;
      default: return '#000000';
    }
  };

  const setThemeValue = (key: string, value: string) => {
    switch (key) {
      case 'accent': setThemeAccent(value); break;
      case 'success': setThemeSuccess(value); break;
      case 'danger': setThemeDanger(value); break;
      case 'warning': setThemeWarning(value); break;
      case 'sidebar-bg': setThemeSidebarBg(value); break;
    }
  };

  const getProcValue = (key: string): boolean => {
    switch (key) {
      case 'copy_paste_disabled': return procCopyPaste;
      case 'tab_switch_detection': return procTabSwitch;
      case 'fullscreen_enforced': return procFullscreen;
      case 'right_click_disabled': return procRightClick;
      case 'keyboard_shortcuts_restricted': return procKeyboardShortcuts;
      default: return false;
    }
  };

  const setProcValue = (key: string, value: boolean) => {
    switch (key) {
      case 'copy_paste_disabled': setProcCopyPaste(value); break;
      case 'tab_switch_detection': setProcTabSwitch(value); break;
      case 'fullscreen_enforced': setProcFullscreen(value); break;
      case 'right_click_disabled': setProcRightClick(value); break;
      case 'keyboard_shortcuts_restricted': setProcKeyboardShortcuts(value); break;
    }
  };

  // ---- Format date ----
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // ---- Get the org name for settings panel title ----
  const settingsOrgName = settingsOrgId
    ? orgs.find((o) => o.id === settingsOrgId)?.name || 'Organization'
    : '';

  return (
    <div>
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 size={28} style={{ color: 'var(--accent)' }} />
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            Organizations
          </h1>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          <Plus size={16} />
          Create Organization
        </button>
      </div>

      {/* ---- Organizations Table ---- */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--card-bg)',
          boxShadow: 'var(--card-shadow)',
          border: '1px solid var(--border)',
        }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2
              size={32}
              className="animate-spin"
              style={{ color: 'var(--accent)' }}
            />
          </div>
        ) : orgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Building2
              size={48}
              style={{ color: 'var(--text-muted)' }}
              className="mb-3"
            />
            <p
              className="text-sm"
              style={{ color: 'var(--text-muted)' }}
            >
              No organizations found. Create one to get started.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th
                  className="text-left text-xs font-semibold uppercase tracking-wider px-6 py-3"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Name
                </th>
                <th
                  className="text-left text-xs font-semibold uppercase tracking-wider px-6 py-3"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Slug
                </th>
                <th
                  className="text-left text-xs font-semibold uppercase tracking-wider px-6 py-3"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Logo
                </th>
                <th
                  className="text-left text-xs font-semibold uppercase tracking-wider px-6 py-3"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Status
                </th>
                <th
                  className="text-left text-xs font-semibold uppercase tracking-wider px-6 py-3"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Created
                </th>
                <th
                  className="text-right text-xs font-semibold uppercase tracking-wider px-6 py-3"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => (
                <tr
                  key={org.id}
                  className="transition-colors"
                  style={{
                    borderBottom: '1px solid var(--border)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <td className="px-6 py-4">
                    <span
                      className="text-sm font-medium"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {org.name}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <code
                      className="text-xs px-2 py-1 rounded"
                      style={{
                        color: 'var(--text-secondary)',
                        backgroundColor: 'var(--bg-secondary)',
                      }}
                    >
                      {org.slug}
                    </code>
                  </td>
                  <td className="px-6 py-4">
                    {org.logo_url ? (
                      <img
                        src={org.logo_url}
                        alt={`${org.name} logo`}
                        className="w-8 h-8 rounded object-cover"
                        style={{ border: '1px solid var(--border)' }}
                      />
                    ) : (
                      <span
                        className="text-sm"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        --
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: org.is_active
                          ? 'color-mix(in srgb, var(--success) 15%, transparent)'
                          : 'color-mix(in srgb, var(--danger) 15%, transparent)',
                        color: org.is_active ? 'var(--success)' : 'var(--danger)',
                      }}
                    >
                      {org.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className="text-sm"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {formatDate(org.created_at)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(org)}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: 'var(--text-secondary)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                          e.currentTarget.style.color = 'var(--accent)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = 'var(--text-secondary)';
                        }}
                        title="Edit organization"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleSettingsToggle(org.id)}
                        className="p-2 rounded-lg transition-colors"
                        style={{
                          color: settingsOrgId === org.id ? 'var(--accent)' : 'var(--text-secondary)',
                          backgroundColor: settingsOrgId === org.id ? 'var(--bg-secondary)' : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                          e.currentTarget.style.color = 'var(--accent)';
                        }}
                        onMouseLeave={(e) => {
                          if (settingsOrgId !== org.id) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                          } else {
                            e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                            e.currentTarget.style.color = 'var(--accent)';
                          }
                        }}
                        title="Organization settings"
                      >
                        <Settings size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ---- Settings Panel ---- */}
      {settingsOrgId && (
        <div
          className="rounded-xl mt-6 overflow-hidden"
          style={{
            backgroundColor: 'var(--card-bg)',
            boxShadow: 'var(--card-shadow)',
            border: '1px solid var(--border)',
          }}
        >
          {/* Settings Header */}
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-2">
              <Settings size={20} style={{ color: 'var(--accent)' }} />
              <h2
                className="text-lg font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                Settings: {settingsOrgName}
              </h2>
            </div>
            <button
              onClick={() => setSettingsOrgId(null)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <X size={18} />
            </button>
          </div>

          {settingsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2
                size={28}
                className="animate-spin"
                style={{ color: 'var(--accent)' }}
              />
            </div>
          ) : settings ? (
            <div className="p-6 space-y-8">
              {/* ---- Theme Config Section ---- */}
              <div>
                <h3
                  className="text-sm font-semibold uppercase tracking-wider mb-4"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Theme Config
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {THEME_KEYS.map(({ key, label }) => (
                    <div
                      key={key}
                      className="flex items-center gap-3 p-3 rounded-lg"
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <input
                        type="color"
                        value={getThemeValue(key)}
                        onChange={(e) => setThemeValue(key, e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer border-0 p-0"
                        style={{ backgroundColor: 'transparent' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-medium"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {label}
                        </p>
                        <p
                          className="text-xs font-mono"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          --{key}: {getThemeValue(key)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ---- Proctoring Defaults Section ---- */}
              <div>
                <h3
                  className="text-sm font-semibold uppercase tracking-wider mb-4"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Proctoring Defaults
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PROCTORING_KEYS.map(({ key, label }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between p-3 rounded-lg"
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <span
                        className="text-sm"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {label}
                      </span>
                      <button
                        type="button"
                        onClick={() => setProcValue(key, !getProcValue(key))}
                        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
                        style={{
                          backgroundColor: getProcValue(key)
                            ? 'var(--accent)'
                            : 'var(--border)',
                        }}
                      >
                        <span
                          className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
                          style={{
                            transform: getProcValue(key)
                              ? 'translateX(1.375rem)'
                              : 'translateX(0.25rem)',
                          }}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* ---- Other Settings Section ---- */}
              <div>
                <h3
                  className="text-sm font-semibold uppercase tracking-wider mb-4"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Other Settings
                </h3>
                <div className="space-y-4">
                  {/* Max Violation Warnings */}
                  <div
                    className="flex items-center justify-between p-3 rounded-lg"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <label
                      className="text-sm"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      Max Violation Warnings
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={maxViolationWarnings}
                      onChange={(e) => setMaxViolationWarnings(parseInt(e.target.value, 10) || 0)}
                      className="w-20 px-3 py-1.5 rounded-lg text-sm text-right focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                      }}
                    />
                  </div>

                  {/* Auto Terminate on Violations */}
                  <div
                    className="flex items-center justify-between p-3 rounded-lg"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <span
                      className="text-sm"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      Auto Terminate on Violations
                    </span>
                    <button
                      type="button"
                      onClick={() => setAutoTerminate(!autoTerminate)}
                      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
                      style={{
                        backgroundColor: autoTerminate
                          ? 'var(--accent)'
                          : 'var(--border)',
                      }}
                    >
                      <span
                        className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
                        style={{
                          transform: autoTerminate
                            ? 'translateX(1.375rem)'
                            : 'translateX(0.25rem)',
                        }}
                      />
                    </button>
                  </div>

                  {/* Allowed AI Providers */}
                  <div
                    className="p-3 rounded-lg"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <label
                      className="text-sm block mb-2"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      Allowed AI Providers
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {aiProviders.map((provider) => (
                        <span
                          key={provider}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                            color: 'var(--accent)',
                          }}
                        >
                          {provider}
                          <button
                            type="button"
                            onClick={() => handleRemoveAiProvider(provider)}
                            className="ml-0.5 hover:opacity-70"
                            style={{ color: 'var(--accent)' }}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                      {aiProviders.length === 0 && (
                        <span
                          className="text-xs"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          No providers added
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={aiProviderInput}
                        onChange={(e) => setAiProviderInput(e.target.value)}
                        onKeyDown={handleAiProviderKeyDown}
                        placeholder="Add a provider..."
                        className="flex-1 px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2"
                        style={{
                          backgroundColor: 'var(--bg-primary)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border)',
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleAddAiProvider}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                        style={{ backgroundColor: 'var(--accent)' }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Save Settings Button */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveSettings}
                  disabled={settingsSaving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {settingsSaving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  {settingsSaving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <p
                className="text-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                No settings data available.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ---- Create / Edit Modal ---- */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onClick={closeModal}
          />

          {/* Modal Content */}
          <div
            className="relative w-full max-w-lg mx-4 rounded-xl overflow-hidden"
            style={{
              backgroundColor: 'var(--card-bg)',
              boxShadow: 'var(--card-shadow)',
              border: '1px solid var(--border)',
            }}
          >
            {/* Modal Header */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <h2
                className="text-lg font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {editingOrg ? 'Edit Organization' : 'Create Organization'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Organization name"
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                  }}
                />
              </div>

              {/* Slug */}
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Slug
                </label>
                <input
                  type="text"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  placeholder="organization-slug"
                  disabled={!!editingOrg}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                  }}
                />
                {!editingOrg && (
                  <p
                    className="text-xs mt-1"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Auto-generated from name. You can edit it manually.
                  </p>
                )}
                {editingOrg && (
                  <p
                    className="text-xs mt-1"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Slug cannot be changed after creation.
                  </p>
                )}
              </div>

              {/* Logo URL */}
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Logo URL
                </label>
                <input
                  type="text"
                  value={formLogo}
                  onChange={(e) => setFormLogo(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                  }}
                />
              </div>

              {/* Active toggle (edit mode only) */}
              {editingOrg && (
                <div
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <span
                    className="text-sm font-medium"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    Active
                  </span>
                  <button
                    type="button"
                    onClick={() => setFormActive(!formActive)}
                    className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
                    style={{
                      backgroundColor: formActive
                        ? 'var(--accent)'
                        : 'var(--border)',
                    }}
                  >
                    <span
                      className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
                      style={{
                        transform: formActive
                          ? 'translateX(1.375rem)'
                          : 'translateX(0.25rem)',
                      }}
                    />
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              className="flex items-center justify-end gap-3 px-6 py-4"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <button
                onClick={closeModal}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  color: 'var(--text-secondary)',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                {saving
                  ? 'Saving...'
                  : editingOrg
                    ? 'Update Organization'
                    : 'Create Organization'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
