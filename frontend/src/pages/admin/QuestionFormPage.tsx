import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { questionService } from '../../services/questionService';
import { taxonomyService } from '../../services/taxonomyService';
import type { QuestionType, DifficultyLevel } from '../../types/question';
import type { Technology, Skill } from '../../types/taxonomy';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  GripVertical,
} from 'lucide-react';
import toast from 'react-hot-toast';

const QUESTION_TYPES: { value: QuestionType; label: string; description: string }[] = [
  { value: 'mcq', label: 'MCQ', description: 'Single correct answer' },
  { value: 'multi_select', label: 'Multi Select', description: 'Multiple correct answers' },
  { value: 'short_answer', label: 'Short Answer', description: 'Free text response' },
  { value: 'coding', label: 'Coding', description: 'Write code with test cases' },
  { value: 'debugging', label: 'Debugging', description: 'Find and fix bugs' },
  { value: 'code_completion', label: 'Code Completion', description: 'Complete partial code' },
  { value: 'system_design', label: 'System Design', description: 'Architecture question' },
  { value: 'scenario', label: 'Scenario', description: 'Real-world scenario' },
];

const DIFFICULTIES: { value: DifficultyLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'expert', label: 'Expert' },
];

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

const LANGUAGES = ['python', 'javascript', 'typescript', 'java', 'go', 'rust', 'cpp', 'c'];

interface OptionForm {
  label: string;
  text: string;
  is_correct: boolean;
  order_index: number;
}

interface TestCaseForm {
  input: string;
  expected_output: string;
  is_hidden: boolean;
  is_sample: boolean;
  order_index: number;
  time_limit_ms: number;
  memory_limit_mb: number;
}

interface CodeStubForm {
  language: string;
  stub_code: string;
  solution_code: string;
}

export default function QuestionFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Core fields
  const [type, setType] = useState<QuestionType>('mcq');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('intermediate');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [explanation, setExplanation] = useState('');
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number | ''>('');
  const [maxScore, setMaxScore] = useState(10);

  // Options (MCQ / Multi-select)
  const [options, setOptions] = useState<OptionForm[]>([
    { label: 'A', text: '', is_correct: false, order_index: 0 },
    { label: 'B', text: '', is_correct: false, order_index: 1 },
    { label: 'C', text: '', is_correct: false, order_index: 2 },
    { label: 'D', text: '', is_correct: false, order_index: 3 },
  ]);

  // Test cases (Coding / Debugging / Code Completion)
  const [testCases, setTestCases] = useState<TestCaseForm[]>([]);

  // Code stubs
  const [codeStubs, setCodeStubs] = useState<CodeStubForm[]>([]);

  // Skill tags
  const [technologies, setTechnologies] = useState<Technology[]>([]);
  const [techSkillsMap, setTechSkillsMap] = useState<Record<string, Skill[]>>({});
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set());
  const [expandedTechForTags, setExpandedTechForTags] = useState<string>('');

  // Load technologies
  useEffect(() => {
    taxonomyService.getTechnologies().then(setTechnologies).catch(() => {});
  }, []);

  // Load question for editing
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    questionService
      .getQuestion(id)
      .then((q) => {
        setType(q.type);
        setDifficulty(q.difficulty);
        setTitle(q.title);
        setBody(q.body);
        setExplanation(q.explanation || '');
        setTimeLimitSeconds(q.time_limit_seconds ?? '');
        setMaxScore(q.max_score);

        if (q.options.length > 0) {
          setOptions(
            q.options.map((o) => ({
              label: o.label,
              text: o.text,
              is_correct: o.is_correct,
              order_index: o.order_index,
            }))
          );
        }

        if (q.test_cases.length > 0) {
          setTestCases(
            q.test_cases.map((tc) => ({
              input: tc.input,
              expected_output: tc.expected_output,
              is_hidden: tc.is_hidden,
              is_sample: tc.is_sample,
              order_index: tc.order_index,
              time_limit_ms: tc.time_limit_ms,
              memory_limit_mb: tc.memory_limit_mb,
            }))
          );
        }

        if (q.code_stubs.length > 0) {
          setCodeStubs(
            q.code_stubs.map((cs) => ({
              language: cs.language,
              stub_code: cs.stub_code,
              solution_code: cs.solution_code || '',
            }))
          );
        }

        if (q.tags.length > 0) {
          setSelectedSkillIds(new Set(q.tags.map((t) => t.skill_id)));
        }
      })
      .catch(() => toast.error('Failed to load question'))
      .finally(() => setLoading(false));
  }, [id]);

  const needsOptions = type === 'mcq' || type === 'multi_select';
  const needsTestCases =
    type === 'coding' || type === 'debugging' || type === 'code_completion';
  const needsCodeStubs = needsTestCases;

  const addOption = () => {
    if (options.length >= 6) return;
    setOptions([
      ...options,
      {
        label: LABELS[options.length],
        text: '',
        is_correct: false,
        order_index: options.length,
      },
    ]);
  };

  const removeOption = (idx: number) => {
    if (options.length <= 2) return;
    const next = options
      .filter((_, i) => i !== idx)
      .map((o, i) => ({ ...o, label: LABELS[i], order_index: i }));
    setOptions(next);
  };

  const updateOption = (idx: number, field: keyof OptionForm, value: string | boolean) => {
    setOptions((prev) =>
      prev.map((o, i) => {
        if (i !== idx) {
          // For MCQ, uncheck others when checking one
          if (field === 'is_correct' && value === true && type === 'mcq') {
            return { ...o, is_correct: false };
          }
          return o;
        }
        return { ...o, [field]: value };
      })
    );
  };

  const addTestCase = () => {
    setTestCases([
      ...testCases,
      {
        input: '',
        expected_output: '',
        is_hidden: false,
        is_sample: true,
        order_index: testCases.length,
        time_limit_ms: 5000,
        memory_limit_mb: 256,
      },
    ]);
  };

  const removeTestCase = (idx: number) => {
    setTestCases(testCases.filter((_, i) => i !== idx).map((tc, i) => ({ ...tc, order_index: i })));
  };

  const updateTestCase = (idx: number, field: keyof TestCaseForm, value: string | boolean | number) => {
    setTestCases((prev) =>
      prev.map((tc, i) => (i === idx ? { ...tc, [field]: value } : tc))
    );
  };

  const addCodeStub = () => {
    const usedLangs = new Set(codeStubs.map((s) => s.language));
    const nextLang = LANGUAGES.find((l) => !usedLangs.has(l)) || 'python';
    setCodeStubs([...codeStubs, { language: nextLang, stub_code: '', solution_code: '' }]);
  };

  const removeCodeStub = (idx: number) => {
    setCodeStubs(codeStubs.filter((_, i) => i !== idx));
  };

  const updateCodeStub = (idx: number, field: keyof CodeStubForm, value: string) => {
    setCodeStubs((prev) =>
      prev.map((cs, i) => (i === idx ? { ...cs, [field]: value } : cs))
    );
  };

  const loadSkillsForTech = async (techId: string) => {
    if (techSkillsMap[techId]) return;
    try {
      const skills = await taxonomyService.getSkills(techId);
      setTechSkillsMap((prev) => ({ ...prev, [techId]: skills }));
    } catch {
      toast.error('Failed to load skills');
    }
  };

  const toggleSkill = (skillId: string) => {
    setSelectedSkillIds((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) next.delete(skillId);
      else next.add(skillId);
      return next;
    });
  };

  const validate = (): string | null => {
    if (!title.trim()) return 'Title is required';
    if (!body.trim()) return 'Question body is required';
    if (needsOptions) {
      if (options.some((o) => !o.text.trim())) return 'All options need text';
      if (!options.some((o) => o.is_correct)) return 'At least one option must be correct';
    }
    return null;
  };

  const handleSubmit = async () => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        type,
        difficulty,
        title: title.trim(),
        body: body.trim(),
        explanation: explanation.trim() || null,
        time_limit_seconds: timeLimitSeconds || null,
        max_score: maxScore,
        skill_ids: Array.from(selectedSkillIds),
      };

      if (needsOptions) {
        payload.options = options;
      }
      if (needsTestCases && testCases.length > 0) {
        payload.test_cases = testCases;
      }
      if (needsCodeStubs && codeStubs.length > 0) {
        payload.code_stubs = codeStubs.filter((s) => s.stub_code.trim());
      }

      if (isEditing && id) {
        await questionService.updateQuestion(id, payload);
        // Update nested data separately
        if (needsOptions) {
          await questionService.updateQuestionOptions(id, options);
        }
        if (needsTestCases && testCases.length > 0) {
          await questionService.updateQuestionTestCases(id, testCases);
        }
        if (needsCodeStubs && codeStubs.length > 0) {
          await questionService.updateQuestionCodeStubs(
            id,
            codeStubs.filter((s) => s.stub_code.trim())
          );
        }
        toast.success('Question updated');
      } else {
        await questionService.createQuestion(payload);
        toast.success('Question created');
      }
      navigate('/admin/questions');
    } catch {
      toast.error('Failed to save question');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/admin/questions')}
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {isEditing ? 'Edit Question' : 'Create Question'}
          </h1>
        </div>
      </div>

      <div className="space-y-6">
        {/* Type + Difficulty */}
        <div
          className="p-5 rounded-xl space-y-4"
          style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}
        >
          <div>
            <label className="text-xs font-semibold uppercase mb-2 block" style={{ color: 'var(--text-muted)' }}>
              Question Type
            </label>
            <div className="grid grid-cols-4 gap-2">
              {QUESTION_TYPES.map((qt) => (
                <button
                  key={qt.value}
                  onClick={() => setType(qt.value)}
                  className="px-3 py-2 rounded-lg text-sm text-left transition-colors"
                  style={{
                    backgroundColor:
                      type === qt.value ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: type === qt.value ? '#fff' : 'var(--text-secondary)',
                    border: `1px solid ${type === qt.value ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  <div className="font-medium">{qt.label}</div>
                  <div className="text-xs opacity-70 mt-0.5">{qt.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase mb-2 block" style={{ color: 'var(--text-muted)' }}>
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase mb-2 block" style={{ color: 'var(--text-muted)' }}>
                Max Score
              </label>
              <input
                type="number"
                value={maxScore}
                onChange={(e) => setMaxScore(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
                min={1}
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase mb-2 block" style={{ color: 'var(--text-muted)' }}>
                Time Limit (seconds)
              </label>
              <input
                type="number"
                value={timeLimitSeconds}
                onChange={(e) =>
                  setTimeLimitSeconds(e.target.value ? Number(e.target.value) : '')
                }
                placeholder="No limit"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
                min={1}
              />
            </div>
          </div>
        </div>

        {/* Title + Body */}
        <div
          className="p-5 rounded-xl space-y-4"
          style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}
        >
          <div>
            <label className="text-xs font-semibold uppercase mb-2 block" style={{ color: 'var(--text-muted)' }}>
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Reverse a linked list"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase mb-2 block" style={{ color: 'var(--text-muted)' }}>
              Question Body (Markdown supported)
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Describe the question..."
              rows={6}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y font-mono"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase mb-2 block" style={{ color: 'var(--text-muted)' }}>
              Explanation (shown after answering)
            </label>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Optional: explain the correct answer..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>

        {/* Options Editor (MCQ / Multi-select) */}
        {needsOptions && (
          <div
            className="p-5 rounded-xl"
            style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
                Options {type === 'mcq' ? '(single correct)' : '(multiple correct)'}
              </label>
              {options.length < 6 && (
                <button
                  onClick={addOption}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                  style={{ color: 'var(--accent)' }}
                >
                  <Plus size={12} /> Add Option
                </button>
              )}
            </div>

            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <div className="flex items-center gap-1 pt-2">
                    <GripVertical size={14} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                  </div>

                  <div
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold shrink-0 mt-1"
                    style={{
                      backgroundColor: opt.is_correct ? 'var(--success)' : 'var(--bg-tertiary)',
                      color: opt.is_correct ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {opt.label}
                  </div>

                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => updateOption(idx, 'text', e.target.value)}
                    placeholder={`Option ${opt.label}`}
                    className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: `1px solid ${opt.is_correct ? 'var(--success)' : 'var(--border)'}`,
                      color: 'var(--text-primary)',
                    }}
                  />

                  <label className="flex items-center gap-1 pt-2 cursor-pointer shrink-0">
                    <input
                      type={type === 'mcq' ? 'radio' : 'checkbox'}
                      checked={opt.is_correct}
                      onChange={(e) => updateOption(idx, 'is_correct', e.target.checked)}
                      name="correct_option"
                      className="accent-[var(--success)]"
                    />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Correct
                    </span>
                  </label>

                  <button
                    onClick={() => removeOption(idx)}
                    disabled={options.length <= 2}
                    className="p-2 rounded-lg disabled:opacity-20"
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Test Cases Editor (Coding types) */}
        {needsTestCases && (
          <div
            className="p-5 rounded-xl"
            style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
                Test Cases
              </label>
              <button
                onClick={addTestCase}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                style={{ color: 'var(--accent)' }}
              >
                <Plus size={12} /> Add Test Case
              </button>
            </div>

            {testCases.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                No test cases yet. Add test cases for automated grading.
              </p>
            ) : (
              <div className="space-y-3">
                {testCases.map((tc, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Test Case #{idx + 1}
                      </span>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={tc.is_sample}
                            onChange={(e) => updateTestCase(idx, 'is_sample', e.target.checked)}
                            className="accent-[var(--accent)]"
                          />
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Sample
                          </span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={tc.is_hidden}
                            onChange={(e) => updateTestCase(idx, 'is_hidden', e.target.checked)}
                            className="accent-[var(--warning)]"
                          />
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Hidden
                          </span>
                        </label>
                        <button
                          onClick={() => removeTestCase(idx)}
                          style={{ color: 'var(--danger)' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>
                          Input
                        </label>
                        <textarea
                          value={tc.input}
                          onChange={(e) => updateTestCase(idx, 'input', e.target.value)}
                          rows={2}
                          className="w-full px-2 py-1.5 rounded text-xs font-mono outline-none resize-y"
                          style={{
                            backgroundColor: 'var(--card-bg)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                          }}
                          placeholder="stdin input..."
                        />
                      </div>
                      <div>
                        <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>
                          Expected Output
                        </label>
                        <textarea
                          value={tc.expected_output}
                          onChange={(e) => updateTestCase(idx, 'expected_output', e.target.value)}
                          rows={2}
                          className="w-full px-2 py-1.5 rounded text-xs font-mono outline-none resize-y"
                          style={{
                            backgroundColor: 'var(--card-bg)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                          }}
                          placeholder="expected stdout..."
                        />
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex items-center gap-1">
                        <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Time (ms):
                        </label>
                        <input
                          type="number"
                          value={tc.time_limit_ms}
                          onChange={(e) => updateTestCase(idx, 'time_limit_ms', Number(e.target.value))}
                          className="w-20 px-2 py-1 rounded text-xs outline-none"
                          style={{
                            backgroundColor: 'var(--card-bg)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Memory (MB):
                        </label>
                        <input
                          type="number"
                          value={tc.memory_limit_mb}
                          onChange={(e) => updateTestCase(idx, 'memory_limit_mb', Number(e.target.value))}
                          className="w-20 px-2 py-1 rounded text-xs outline-none"
                          style={{
                            backgroundColor: 'var(--card-bg)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Code Stubs Editor */}
        {needsCodeStubs && (
          <div
            className="p-5 rounded-xl"
            style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
                Code Stubs (starter code per language)
              </label>
              <button
                onClick={addCodeStub}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                style={{ color: 'var(--accent)' }}
              >
                <Plus size={12} /> Add Language
              </button>
            </div>

            {codeStubs.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                No code stubs yet. Add starter code for each language.
              </p>
            ) : (
              <div className="space-y-4">
                {codeStubs.map((stub, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <select
                        value={stub.language}
                        onChange={(e) => updateCodeStub(idx, 'language', e.target.value)}
                        className="px-2 py-1 rounded text-sm outline-none"
                        style={{
                          backgroundColor: 'var(--card-bg)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {LANGUAGES.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                      <button onClick={() => removeCodeStub(idx)} style={{ color: 'var(--danger)' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>
                          Stub Code (shown to candidate)
                        </label>
                        <textarea
                          value={stub.stub_code}
                          onChange={(e) => updateCodeStub(idx, 'stub_code', e.target.value)}
                          rows={5}
                          className="w-full px-2 py-1.5 rounded text-xs font-mono outline-none resize-y"
                          style={{
                            backgroundColor: 'var(--card-bg)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                          }}
                          placeholder="def solution(n):&#10;    # your code here&#10;    pass"
                        />
                      </div>
                      <div>
                        <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>
                          Solution Code (for validation)
                        </label>
                        <textarea
                          value={stub.solution_code}
                          onChange={(e) => updateCodeStub(idx, 'solution_code', e.target.value)}
                          rows={5}
                          className="w-full px-2 py-1.5 rounded text-xs font-mono outline-none resize-y"
                          style={{
                            backgroundColor: 'var(--card-bg)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                          }}
                          placeholder="def solution(n):&#10;    return n * 2"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Skill Tags */}
        <div
          className="p-5 rounded-xl"
          style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}
        >
          <label className="text-xs font-semibold uppercase mb-3 block" style={{ color: 'var(--text-muted)' }}>
            Skill Tags ({selectedSkillIds.size} selected)
          </label>

          {selectedSkillIds.size > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {Array.from(selectedSkillIds).map((sid) => {
                const skill = Object.values(techSkillsMap)
                  .flat()
                  .find((s) => s.id === sid);
                return (
                  <span
                    key={sid}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                    style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                  >
                    {skill?.name || sid.slice(0, 8)}
                    <button onClick={() => toggleSkill(sid)} className="ml-0.5">
                      &times;
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <div className="space-y-1">
            {technologies.map((tech) => (
              <div key={tech.id}>
                <button
                  onClick={() => {
                    loadSkillsForTech(tech.id);
                    setExpandedTechForTags(expandedTechForTags === tech.id ? '' : tech.id);
                  }}
                  className="w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors"
                  style={{
                    color: 'var(--text-primary)',
                    backgroundColor:
                      expandedTechForTags === tech.id ? 'var(--bg-secondary)' : 'transparent',
                  }}
                >
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {expandedTechForTags === tech.id ? '▼' : '▶'}
                  </span>
                  {tech.name}
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full ml-auto"
                    style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
                  >
                    {tech.category}
                  </span>
                </button>
                {expandedTechForTags === tech.id && techSkillsMap[tech.id] && (
                  <div className="flex flex-wrap gap-1.5 pl-8 pb-2 pt-1">
                    {techSkillsMap[tech.id].map((skill) => (
                      <button
                        key={skill.id}
                        onClick={() => toggleSkill(skill.id)}
                        className="px-2 py-0.5 rounded-full text-xs transition-colors"
                        style={{
                          backgroundColor: selectedSkillIds.has(skill.id)
                            ? 'var(--accent)'
                            : 'var(--bg-tertiary)',
                          color: selectedSkillIds.has(skill.id)
                            ? '#fff'
                            : 'var(--text-secondary)',
                          border: `1px solid ${selectedSkillIds.has(skill.id) ? 'var(--accent)' : 'var(--border)'}`,
                        }}
                      >
                        {skill.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pb-8">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {saving && <Loader2 className="animate-spin" size={16} />}
            {isEditing ? 'Update Question' : 'Create Question'}
          </button>
          <button
            onClick={() => navigate('/admin/questions')}
            className="px-6 py-2.5 rounded-lg text-sm font-medium"
            style={{
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
