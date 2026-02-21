import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, Eye, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { assessmentService } from '../../services/assessmentService';
import type { Assessment, AssessmentStatus } from '../../types/assessment';

const statusColors: Record<AssessmentStatus, { bg: string; text: string }> = {
  draft: { bg: '#6b728020', text: '#6b7280' },
  published: { bg: '#3b82f620', text: '#3b82f6' },
  active: { bg: '#10b98120', text: '#10b981' },
  closed: { bg: '#ef444420', text: '#ef4444' },
  archived: { bg: '#9ca3af20', text: '#9ca3af' },
};

export default function AssessmentListPage() {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchAssessments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await assessmentService.getAssessments({
        page,
        page_size: pageSize,
        status: statusFilter || undefined,
        search: search || undefined,
      });
      setAssessments(data.assessments);
      setTotal(data.total);
    } catch {
      toast.error('Failed to load assessments');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter]);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete assessment "${title}"?`)) return;
    try {
      await assessmentService.deleteAssessment(id);
      toast.success('Assessment deleted');
      fetchAssessments();
    } catch {
      toast.error('Failed to delete assessment');
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Assessments
        </h1>
        <Link
          to="/hr/assessments/create"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          <Plus size={16} />
          Create Assessment
        </Link>
      </div>

      {/* Filters */}
      <div
        className="flex gap-3 mb-4 p-4 rounded-xl"
        style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--border)',
        }}
      >
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            placeholder="Search assessments..."
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
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
          <option value="archived">Archived</option>
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
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Title', 'Status', 'Questions', 'Passing Score', 'Time Limit', 'Created', 'Actions'].map(
                (h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-semibold uppercase"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                  Loading...
                </td>
              </tr>
            ) : assessments.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                  No assessments found. Create your first one!
                </td>
              </tr>
            ) : (
              assessments.map((a) => {
                const colors = statusColors[a.status] || statusColors.draft;
                return (
                  <tr
                    key={a.id}
                    className="hover:opacity-80"
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <td className="px-4 py-3">
                      <span
                        className="font-medium text-sm cursor-pointer"
                        style={{ color: 'var(--accent)' }}
                        onClick={() => navigate(`/hr/assessments/${a.id}`)}
                      >
                        {a.title}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-1 rounded-full text-xs font-medium capitalize"
                        style={{ backgroundColor: colors.bg, color: colors.text }}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      --
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {a.passing_score_pct}%
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {a.time_limit_minutes ? `${a.time_limit_minutes} min` : 'No limit'}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(a.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/hr/assessments/${a.id}`)}
                          className="p-1.5 rounded-lg hover:opacity-80"
                          style={{ color: 'var(--accent)' }}
                          title="View"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => navigate(`/hr/assessments/${a.id}/edit`)}
                          className="p-1.5 rounded-lg hover:opacity-80"
                          style={{ color: 'var(--warning)' }}
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(a.id, a.title)}
                          className="p-1.5 rounded-lg hover:opacity-80"
                          style={{ color: 'var(--danger)' }}
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

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
    </div>
  );
}
