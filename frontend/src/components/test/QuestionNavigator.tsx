import type { TestQuestion } from '../../types/test';

interface QuestionNavigatorProps {
  questions: TestQuestion[];
  currentIndex: number;
  responses: Record<
    string,
    {
      selected_option_ids?: string[];
      text_response?: string;
      code_response?: string;
      is_flagged: boolean;
    }
  >;
  onNavigate: (index: number) => void;
}

export default function QuestionNavigator({
  questions,
  currentIndex,
  responses,
  onNavigate,
}: QuestionNavigatorProps) {
  const getButtonStyle = (index: number, questionId: string): React.CSSProperties => {
    const response = responses[questionId];
    const isCurrent = index === currentIndex;

    if (isCurrent) {
      return {
        backgroundColor: 'var(--accent)',
        color: '#fff',
        borderColor: 'var(--accent)',
      };
    }

    const isFlagged = response?.is_flagged;
    const isAnswered =
      (response?.selected_option_ids && response.selected_option_ids.length > 0) ||
      !!response?.text_response ||
      !!response?.code_response;

    if (isFlagged) {
      return {
        backgroundColor: '#f59e0b',
        color: '#fff',
        borderColor: '#f59e0b',
      };
    }

    if (isAnswered) {
      return {
        backgroundColor: '#10b981',
        color: '#fff',
        borderColor: '#10b981',
      };
    }

    return {
      backgroundColor: 'var(--bg-secondary)',
      color: 'var(--text-muted)',
      borderColor: 'var(--border)',
    };
  };

  return (
    <div>
      <div className="grid grid-cols-5 gap-2">
        {questions.map((q, i) => (
          <button
            key={q.id}
            onClick={() => onNavigate(i)}
            className="w-9 h-9 rounded-lg text-xs font-semibold border transition-colors"
            style={getButtonStyle(i, q.id)}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        <LegendItem color="var(--accent)" label="Current" />
        <LegendItem color="#10b981" label="Answered" />
        <LegendItem color="#f59e0b" label="Flagged" />
        <LegendItem color="var(--bg-secondary)" label="Unanswered" border="var(--border)" />
      </div>
    </div>
  );
}

function LegendItem({
  color,
  label,
  border,
}: {
  color: string;
  label: string;
  border?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="w-3 h-3 rounded-sm inline-block"
        style={{
          backgroundColor: color,
          border: border ? `1px solid ${border}` : undefined,
        }}
      />
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
    </div>
  );
}
