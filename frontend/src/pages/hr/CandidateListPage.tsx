import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, Eye, Users, Mail, Upload, Download, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { candidateService } from '../../services/candidateService';
import type { CandidateInvitation, CandidateSession, InvitationStatus, SessionStatus } from '../../types/assessment';

const invStatusColors: Record<InvitationStatus, { bg: string; text: string }> = {
  pending: { bg: '#f59e0b20', text: '#f59e0b' },
  sent: { bg: '#3b82f620', text: '#3b82f6' },
  opened: { bg: '#3b82f620', text: '#3b82f6' },
  started: { bg: '#10b98120', text: '#10b981' },
  completed: { bg: '#10b98120', text: '#10b981' },
  expired: { bg: '#ef444420', text: '#ef4444' },
  cancelled: { bg: '#9ca3af20', text: '#9ca3af' },
};

const sesStatusColors: Record<SessionStatus, { bg: string; text: string }> = {
  not_started: { bg: '#6b728020', text: '#6b7280' },
  in_progress: { bg: '#3b82f620', text: '#3b82f6' },
  completed: { bg: '#10b98120', text: '#10b981' },
  terminated: { bg: '#ef444420', text: '#ef4444' },
  timed_out: { bg: '#f59e0b20', text: '#f59e0b' },
};

type Tab = 'invitations' | 'sessions';

export default function CandidateListPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('invitations');
  const [invitations, setInvitations] = useState<CandidateInvitation[]>([]);
  const [sessions, setSessions] = useState<CandidateSession[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // CSV upload
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [csvAssessmentId, setCsvAssessmentId] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'invitations') {
        const data = await candidateService.getInvitations({
          page,
          page_size: pageSize,
          status: statusFilter || undefined,
          search: search || undefined,
        });
        setInvitations(data.invitations);
        setTotal(data.total);
      } else {
        const data = await candidateService.getSessions({
          page,
          page_size: pageSize,
          status: statusFilter || undefined,
        });
        setSessions(data.sessions);
        setTotal(data.total);
      }
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [tab, page, pageSize, search, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
    setStatusFilter('');
    setSearch('');
  }, [tab]);

  const totalPages = Math.ceil(total / pageSize);

  const invStatusOptions = ['pending', 'sent', 'opened', 'started', 'completed', 'expired', 'cancelled'];
  const sesStatusOptions = ['not_started', 'in_progress', 'completed', 'terminated', 'timed_out'];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Candidates
        </h1>
        <button
          onClick={() => setShowCSVModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        >
          <Upload size={16} />
          CSV Import
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {(['invitations', 'sessions'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium capitalize"
            style={{
              backgroundColor: tab === t ? 'var(--accent)' : 'var(--bg-secondary)',
              color: tab === t ? '#fff' : 'var(--text-secondary)',
            }}
          >
            {t === 'invitations' ? <Mail size={15} /> : <Users size={15} />}
            {t}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div
        className="flex gap-3 mb-4 p-4 rounded-xl"
        style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}
      >
        {tab === 'invitations' && (
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              placeholder="Search by email or name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
            />
          </div>
        )}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg text-sm"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
          }}
        >
          <option value="">All Status</option>
          {(tab === 'invitations' ? invStatusOptions : sesStatusOptions).map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        {tab === 'invitations' ? (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Name', 'Email', 'Status', 'Sent', 'Expires', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-semibold uppercase"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Loading...</td></tr>
              ) : invitations.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12" style={{ color: 'var(--text-muted)' }}>No invitations found</td></tr>
              ) : (
                invitations.map((inv) => {
                  const colors = invStatusColors[inv.status] || invStatusColors.pending;
                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{inv.candidate_name}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{inv.candidate_email}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded-full text-xs font-medium capitalize" style={{ backgroundColor: colors.bg, color: colors.text }}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {inv.sent_at ? new Date(inv.sent_at).toLocaleDateString() : '--'}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : 'No expiry'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          className="p-1.5 rounded-lg"
                          style={{ color: 'var(--accent)' }}
                          title="Copy invite link"
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/test/verify/${inv.token}`);
                            toast.success('Link copied');
                          }}
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Name', 'Email', 'Status', 'Score', 'Started', 'Violations', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-semibold uppercase"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Loading...</td></tr>
              ) : sessions.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12" style={{ color: 'var(--text-muted)' }}>No sessions found</td></tr>
              ) : (
                sessions.map((ses) => {
                  const colors = sesStatusColors[ses.status] || sesStatusColors.not_started;
                  return (
                    <tr key={ses.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{ses.candidate_name}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{ses.candidate_email}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded-full text-xs font-medium capitalize" style={{ backgroundColor: colors.bg, color: colors.text }}>
                          {ses.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>
                        {ses.score_pct != null ? `${ses.score_pct.toFixed(1)}%` : '--'}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {ses.started_at ? new Date(ses.started_at).toLocaleString() : '--'}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: ses.proctoring_violations > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                        {ses.proctoring_violations}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigate(`/hr/candidates/sessions/${ses.id}`)}
                          className="p-1.5 rounded-lg"
                          style={{ color: 'var(--accent)' }}
                          title="View"
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {total > 0 && (
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg disabled:opacity-40"
                style={{ color: 'var(--text-secondary)' }}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg disabled:opacity-40"
                style={{ color: 'var(--text-secondary)' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CSV Upload Modal */}
      {showCSVModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="w-full max-w-md rounded-xl p-6"
            style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                Import Candidates from CSV
              </h2>
              <button onClick={() => { setShowCSVModal(false); setCsvFile(null); setCsvAssessmentId(''); }} className="cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Assessment ID</label>
                <input
                  type="text"
                  value={csvAssessmentId}
                  onChange={(e) => setCsvAssessmentId(e.target.value)}
                  placeholder="Paste assessment ID..."
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>CSV File</label>
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-secondary)' }}
                  onClick={() => csvInputRef.current?.click()}
                >
                  <Upload size={24} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {csvFile ? csvFile.name : 'Click to select CSV file'}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Columns: email (required), name (optional)
                  </p>
                </div>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                />
              </div>

              <button
                onClick={() => candidateService.downloadCSVTemplate()}
                className="flex items-center gap-2 text-sm cursor-pointer"
                style={{ color: 'var(--accent)' }}
              >
                <Download size={14} />
                Download CSV template
              </button>

              <button
                onClick={async () => {
                  if (!csvAssessmentId || !csvFile) {
                    toast.error('Please provide assessment ID and CSV file');
                    return;
                  }
                  setCsvUploading(true);
                  try {
                    const result = await candidateService.uploadCSV(csvAssessmentId, csvFile);
                    toast.success(`Invited ${result.invited} candidates (${result.skipped} skipped)`);
                    setShowCSVModal(false);
                    setCsvFile(null);
                    setCsvAssessmentId('');
                    fetchData();
                  } catch {
                    toast.error('Failed to upload CSV');
                  } finally {
                    setCsvUploading(false);
                  }
                }}
                disabled={csvUploading || !csvAssessmentId || !csvFile}
                className="w-full py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 cursor-pointer"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {csvUploading ? 'Uploading...' : 'Upload & Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
