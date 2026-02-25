import type { TestQuestion } from '../../types/test';
import CodeEditor from './CodeEditor';

interface QuestionResponse {
  selected_option_ids?: string[];
  text_response?: string;
  code_response?: string;
  code_language?: string;
}

interface QuestionRendererProps {
  question: TestQuestion;
  response: QuestionResponse;
  onResponseChange: (update: QuestionResponse) => void;
}

const difficultyColors: Record<string, string> = {
  beginner: '#10b981',
  intermediate: '#3b82f6',
  advanced: '#f59e0b',
  expert: '#ef4444',
};

export default function QuestionRenderer({
  question,
  response,
  onResponseChange,
}: QuestionRendererProps) {
  const renderQuestionContent = () => {
    switch (question.type) {
      case 'mcq':
        return renderMCQ();
      case 'multi_select':
        return renderMultiSelect();
      case 'short_answer':
        return renderShortAnswer();
      case 'coding':
      case 'debugging':
      case 'code_completion':
        return renderCodeQuestion();
      case 'system_design':
      case 'scenario':
        return renderLongAnswer();
      default:
        return renderShortAnswer();
    }
  };

  const renderMCQ = () => {
    const selectedId = response.selected_option_ids?.[0];
    const sortedOptions = [...question.options].sort(
      (a, b) => a.order_index - b.order_index
    );

    return (
      <div className="flex flex-col gap-2">
        {sortedOptions.map((option) => {
          const isSelected = selectedId === option.id;
          return (
            <label
              key={option.id}
              className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
              style={{
                backgroundColor: isSelected ? 'var(--bg-secondary)' : 'var(--card-bg)',
                borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
              }}
            >
              <input
                type="radio"
                name={`question-${question.id}`}
                checked={isSelected}
                onChange={() =>
                  onResponseChange({ selected_option_ids: [option.id] })
                }
                className="mt-0.5"
                style={{ accentColor: 'var(--accent)' }}
              />
              <div>
                <span
                  className="text-xs font-semibold mr-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {option.label}.
                </span>
                <span style={{ color: 'var(--text-primary)' }}>
                  {option.text}
                </span>
              </div>
            </label>
          );
        })}
      </div>
    );
  };

  const renderMultiSelect = () => {
    const selectedIds = response.selected_option_ids ?? [];
    const sortedOptions = [...question.options].sort(
      (a, b) => a.order_index - b.order_index
    );

    const handleToggle = (optionId: string) => {
      const updated = selectedIds.includes(optionId)
        ? selectedIds.filter((id) => id !== optionId)
        : [...selectedIds, optionId];
      onResponseChange({ selected_option_ids: updated });
    };

    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
          Select all that apply
        </p>
        {sortedOptions.map((option) => {
          const isSelected = selectedIds.includes(option.id);
          return (
            <label
              key={option.id}
              className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
              style={{
                backgroundColor: isSelected ? 'var(--bg-secondary)' : 'var(--card-bg)',
                borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleToggle(option.id)}
                className="mt-0.5"
                style={{ accentColor: 'var(--accent)' }}
              />
              <div>
                <span
                  className="text-xs font-semibold mr-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {option.label}.
                </span>
                <span style={{ color: 'var(--text-primary)' }}>
                  {option.text}
                </span>
              </div>
            </label>
          );
        })}
      </div>
    );
  };

  const renderShortAnswer = () => (
    <textarea
      value={response.text_response ?? ''}
      onChange={(e) => onResponseChange({ text_response: e.target.value })}
      rows={6}
      placeholder="Type your answer here..."
      className="w-full rounded-lg border p-3 text-sm outline-none resize-y"
      style={{
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--border)',
        color: 'var(--text-primary)',
      }}
    />
  );

  const renderLongAnswer = () => (
    <textarea
      value={response.text_response ?? ''}
      onChange={(e) => onResponseChange({ text_response: e.target.value })}
      rows={12}
      placeholder="Describe your approach in detail..."
      className="w-full rounded-lg border p-3 text-sm outline-none resize-y"
      style={{
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--border)',
        color: 'var(--text-primary)',
      }}
    />
  );

  const renderCodeQuestion = () => {
    const stubs = question.code_stubs;
    const availableLanguages = stubs.length > 0 ? stubs.map((s) => s.language) : ['javascript'];
    const currentLanguage = response.code_language ?? availableLanguages[0];
    const currentStub = stubs.find((s) => s.language === currentLanguage);
    const codeValue = response.code_response ?? currentStub?.stub_code ?? '';

    const sortedTestCases = [...question.test_cases].sort(
      (a, b) => a.order_index - b.order_index
    );

    return (
      <div className="flex flex-col gap-4">
        <CodeEditor
          value={codeValue}
          language={currentLanguage}
          availableLanguages={availableLanguages}
          onChange={(value) => onResponseChange({ code_response: value, code_language: currentLanguage })}
          onLanguageChange={(lang) => {
            const stub = stubs.find((s) => s.language === lang);
            onResponseChange({
              code_language: lang,
              code_response: response.code_response ?? stub?.stub_code ?? '',
            });
          }}
          testCases={sortedTestCases.map((tc) => ({
            id: tc.id,
            input: tc.input,
            expected_output: tc.expected_output,
          }))}
        />

        {sortedTestCases.length > 0 && (
          <div
            className="rounded-lg border p-4"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderColor: 'var(--border)',
            }}
          >
            <h4
              className="text-sm font-semibold mb-3"
              style={{ color: 'var(--text-primary)' }}
            >
              Sample Test Cases
            </h4>
            <div className="flex flex-col gap-3">
              {sortedTestCases.map((tc, i) => (
                <div
                  key={tc.id}
                  className="rounded-lg border p-3"
                  style={{
                    backgroundColor: 'var(--card-bg)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <p
                    className="text-xs font-semibold mb-2"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Test Case {i + 1}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p
                        className="text-xs mb-1"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Input
                      </p>
                      <pre
                        className="text-xs p-2 rounded overflow-x-auto font-mono"
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {tc.input}
                      </pre>
                    </div>
                    <div>
                      <p
                        className="text-xs mb-1"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Expected Output
                      </p>
                      <pre
                        className="text-xs p-2 rounded overflow-x-auto font-mono"
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {tc.expected_output}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Question header */}
      <div className="flex items-start justify-between gap-4">
        <h2
          className="text-lg font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          {question.title}
        </h2>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="px-2 py-0.5 rounded text-xs font-medium"
            style={{
              backgroundColor: difficultyColors[question.difficulty] ?? 'var(--text-muted)',
              color: '#fff',
            }}
          >
            {question.difficulty}
          </span>
          <span
            className="text-xs font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            {question.max_score} pts
          </span>
        </div>
      </div>

      {/* Question body */}
      {question.body && (
        <div
          className="text-sm leading-relaxed whitespace-pre-wrap"
          style={{ color: 'var(--text-secondary)' }}
        >
          {question.body}
        </div>
      )}

      {/* Question-type-specific content */}
      {renderQuestionContent()}
    </div>
  );
}
