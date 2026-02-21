import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { questionService } from '../../services/questionService';
import { taxonomyService } from '../../services/taxonomyService';
import type { Question, QuestionType, DifficultyLevel } from '../../types/question';
import type { Technology, Skill } from '../../types/taxonomy';
import AIQuestionGenerator from '../../components/assessment/AIQuestionGenerator';
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Trash2,
  Eye,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'mcq', label: 'MCQ' },
  { value: 'multi_select', label: 'Multi Select' },
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'coding', label: 'Coding' },
  { value: 'debugging', label: 'Debugging' },
  { value: 'code_completion', label: 'Code Completion' },
  { value: 'system_design', label: 'System Design' },
  { value: 'scenario', label: 'Scenario' },
];

const DIFFICULTIES: { value: DifficultyLevel; label: string; color: string }[] = [
  { value: 'beginner', label: 'Beginner', color: 'var(--success)' },
  { value: 'intermediate', label: 'Intermediate', color: 'var(--accent)' },
  { value: 'advanced', label: 'Advanced', color: 'var(--warning)' },
  { value: 'expert', label: 'Expert', color: 'var(--danger)' },
];

export default function QuestionBankPage() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [filterSkillId, setFilterSkillId] = useState('');

  // Taxonomy data for skill filter
  const [technologies, setTechnologies] = useState<Technology[]>([]);
  const [selectedTechId, setSelectedTechId] = useState('');
  const [skills, setSkills] = useState<Skill[]>([]);

  // Preview modal
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);

  // AI Generator modal
  const [showAIGenerator, setShowAIGenerator] = useState(false);

  const fetchQuestions = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, unknown> = {
        page,
        page_size: pageSize,
      };
      if (searchQuery) params.search = searchQuery;
      if (filterType) params.type = filterType;
      if (filterDifficulty) params.difficulty = filterDifficulty;
      if (filterSkillId) params.skill_id = filterSkillId;

      const data = await questionService.getQuestions(params as Parameters<typeof questionService.getQuestions>[0]);
      setQuestions(data.questions);
      setTotal(data.total);
    } catch {
      toast.error('Failed to load questions');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchQuery, filterType, filterDifficulty, filterSkillId]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  useEffect(() => {
    taxonomyService.getTechnologies().then(setTechnologies).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedTechId) {
      taxonomyService.getSkills(selectedTechId).then(setSkills).catch(() => {});
    } else {
      setSkills([]);
      setFilterSkillId('');
    }
  }, [selectedTechId]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this question? This action cannot be undone.')) return;
    try {
      await questionService.deleteQuestion(id);
      toast.success('Question deleted');
      fetchQuestions();
    } catch {
      toast.error('Failed to delete question');
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const getDifficultyStyle = (difficulty: string) => {
    const d = DIFFICULTIES.find((x) => x.value === difficulty);
    return d ? { color: d.color } : {};
  };

  const getTypeLabel = (type: string) => {
    return QUESTION_TYPES.find((t) => t.value === type)?.label || type;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Question Bank
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {total} questions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAIGenerator(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: 'var(--warning)', color: '#fff' }}
          >
            <Sparkles size={16} />
            AI Generate
          </button>
          <button
            onClick={() => navigate('/admin/questions/new')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <Plus size={16} />
            Add Question
          </button>
        </div>
      </div>

      {/* Filters */}
      <div
        className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-lg"
        style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}
      >
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="">All Types</option>
          {QUESTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <select
          value={filterDifficulty}
          onChange={(e) => {
            setFilterDifficulty(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="">All Difficulties</option>
          {DIFFICULTIES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>

        <select
          value={selectedTechId}
          onChange={(e) => {
            setSelectedTechId(e.target.value);
            setFilterSkillId('');
            setPage(1);
          }}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="">All Technologies</option>
          {technologies.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        {skills.length > 0 && (
          <select
            value={filterSkillId}
            onChange={(e) => {
              setFilterSkillId(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="">All Skills</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Questions Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--border)',
        }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th
                className="text-left px-4 py-3 font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Title
              </th>
              <th
                className="text-left px-4 py-3 font-medium w-32"
                style={{ color: 'var(--text-secondary)' }}
              >
                Type
              </th>
              <th
                className="text-left px-4 py-3 font-medium w-32"
                style={{ color: 'var(--text-secondary)' }}
              >
                Difficulty
              </th>
              <th
                className="text-center px-4 py-3 font-medium w-20"
                style={{ color: 'var(--text-secondary)' }}
              >
                Score
              </th>
              <th
                className="text-center px-4 py-3 font-medium w-20"
                style={{ color: 'var(--text-secondary)' }}
              >
                Used
              </th>
              <th
                className="text-right px-4 py-3 font-medium w-28"
                style={{ color: 'var(--text-secondary)' }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-12">
                  <Loader2
                    className="animate-spin inline-block"
                    size={24}
                    style={{ color: 'var(--accent)' }}
                  />
                </td>
              </tr>
            ) : questions.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-center py-12"
                  style={{ color: 'var(--text-muted)' }}
                >
                  No questions found. Create your first question.
                </td>
              </tr>
            ) : (
              questions.map((q) => (
                <tr
                  key={q.id}
                  className="transition-colors hover:brightness-95"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <td className="px-4 py-3">
                    <div
                      className="font-medium truncate max-w-md"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {q.title}
                    </div>
                    {q.tags.length > 0 && (
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {q.tags.length} skill{q.tags.length !== 1 ? 's' : ''} tagged
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {getTypeLabel(q.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium capitalize" style={getDifficultyStyle(q.difficulty)}>
                      {q.difficulty}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center" style={{ color: 'var(--text-secondary)' }}>
                    {q.max_score}
                  </td>
                  <td className="px-4 py-3 text-center" style={{ color: 'var(--text-secondary)' }}>
                    {q.usage_count}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setPreviewQuestion(q)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        title="Preview"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        onClick={() => navigate(`/admin/questions/${q.id}/edit`)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--accent)' }}
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(q.id)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--danger)' }}
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg disabled:opacity-30 transition-colors"
              style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1
              )
              .map((p, idx, arr) => (
                <span key={p}>
                  {idx > 0 && arr[idx - 1] !== p - 1 && (
                    <span className="px-1" style={{ color: 'var(--text-muted)' }}>
                      ...
                    </span>
                  )}
                  <button
                    onClick={() => setPage(p)}
                    className="w-8 h-8 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: p === page ? 'var(--accent)' : 'transparent',
                      color: p === page ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {p}
                  </button>
                </span>
              ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg disabled:opacity-30 transition-colors"
              style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewQuestion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setPreviewQuestion(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl p-6"
            style={{ backgroundColor: 'var(--card-bg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {previewQuestion.title}
              </h2>
              <button
                onClick={() => setPreviewQuestion(null)}
                style={{ color: 'var(--text-muted)' }}
              >
                <span className="text-xl">&times;</span>
              </button>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
              >
                {getTypeLabel(previewQuestion.type)}
              </span>
              <span
                className="text-xs font-medium capitalize"
                style={getDifficultyStyle(previewQuestion.difficulty)}
              >
                {previewQuestion.difficulty}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {previewQuestion.max_score} pts
              </span>
              {previewQuestion.time_limit_seconds && (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {previewQuestion.time_limit_seconds}s
                </span>
              )}
            </div>

            <div
              className="text-sm mb-4 whitespace-pre-wrap"
              style={{ color: 'var(--text-primary)' }}
            >
              {previewQuestion.body}
            </div>

            {previewQuestion.options.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold mb-2 uppercase" style={{ color: 'var(--text-muted)' }}>
                  Options
                </h3>
                <div className="space-y-1">
                  {previewQuestion.options.map((opt) => (
                    <div
                      key={opt.id}
                      className="flex items-center gap-2 px-3 py-2 rounded text-sm"
                      style={{
                        backgroundColor: opt.is_correct ? 'rgba(16,185,129,0.1)' : 'var(--bg-secondary)',
                        border: opt.is_correct ? '1px solid var(--success)' : '1px solid var(--border)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <span className="font-medium">{opt.label}.</span> {opt.text}
                      {opt.is_correct && (
                        <span className="ml-auto text-xs" style={{ color: 'var(--success)' }}>
                          Correct
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {previewQuestion.test_cases.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold mb-2 uppercase" style={{ color: 'var(--text-muted)' }}>
                  Test Cases ({previewQuestion.test_cases.length})
                </h3>
                <div className="space-y-2">
                  {previewQuestion.test_cases.slice(0, 3).map((tc, i) => (
                    <div
                      key={tc.id}
                      className="text-xs p-2 rounded"
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                    >
                      <div>
                        <span className="font-medium">#{i + 1}</span>
                        {tc.is_hidden && <span className="ml-1 opacity-60">(Hidden)</span>}
                        {tc.is_sample && <span className="ml-1 opacity-60">(Sample)</span>}
                      </div>
                      <div>Input: <code>{tc.input}</code></div>
                      <div>Expected: <code>{tc.expected_output}</code></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {previewQuestion.explanation && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold mb-2 uppercase" style={{ color: 'var(--text-muted)' }}>
                  Explanation
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {previewQuestion.explanation}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => {
                  setPreviewQuestion(null);
                  navigate(`/admin/questions/${previewQuestion.id}/edit`);
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Edit Question
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Question Generator Modal */}
      {showAIGenerator && (
        <AIQuestionGenerator
          availableSkills={skills.length > 0 ? skills.map(s => s.name) : technologies.flatMap(t => [t.name])}
          onClose={() => setShowAIGenerator(false)}
          onAddToBank={async (question) => {
            try {
              await questionService.createQuestion(question);
              toast.success('Question added to bank');
              fetchQuestions();
            } catch {
              toast.error('Failed to add question');
            }
          }}
        />
      )}
    </div>
  );
}
