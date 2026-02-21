import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { sandboxService } from '../../services/sandboxService';
import type { ExecutionResult, RunTestCasesResponse } from '../../services/sandboxService';

interface TestCase {
  id: string;
  input: string;
  expected_output: string;
}

interface CodeEditorProps {
  value: string;
  language: string;
  availableLanguages: string[];
  onChange: (value: string) => void;
  onLanguageChange: (lang: string) => void;
  testCases?: TestCase[];
  showRunButton?: boolean;
}

export default function CodeEditor({
  value,
  language,
  availableLanguages,
  onChange,
  onLanguageChange,
  testCases = [],
  showRunButton = true,
}: CodeEditorProps) {
  const { theme } = useThemeStore();
  const [running, setRunning] = useState(false);
  const [execResult, setExecResult] = useState<ExecutionResult | null>(null);
  const [testResults, setTestResults] = useState<RunTestCasesResponse | null>(null);
  const [activeOutputTab, setActiveOutputTab] = useState<'output' | 'tests'>('output');

  const handleRunCode = async () => {
    setRunning(true);
    setExecResult(null);
    setTestResults(null);
    try {
      const result = await sandboxService.candidateExecute(value, language);
      setExecResult(result);
      setActiveOutputTab('output');
    } catch {
      setExecResult({
        stdout: '',
        stderr: 'Failed to execute code. Please try again.',
        exit_code: -1,
        timed_out: false,
        execution_time_ms: 0,
        error: 'Connection error',
      });
    }
    setRunning(false);
  };

  const handleRunTests = async () => {
    if (testCases.length === 0) return;
    setRunning(true);
    setExecResult(null);
    setTestResults(null);
    try {
      const result = await sandboxService.candidateRunTests(
        value,
        language,
        testCases.map((tc) => ({
          id: tc.id,
          input: tc.input,
          expected_output: tc.expected_output,
        }))
      );
      setTestResults(result);
      setActiveOutputTab('tests');
    } catch {
      setTestResults({
        results: [],
        total: 0,
        passed: 0,
        failed: 0,
      });
    }
    setRunning(false);
  };

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex items-center gap-3">
          <label
            className="text-xs font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            Language
          </label>
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="px-2 py-1 rounded text-sm border outline-none"
            style={{
              backgroundColor: 'var(--card-bg)',
              color: 'var(--text-primary)',
              borderColor: 'var(--border)',
            }}
          >
            {availableLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {lang.charAt(0).toUpperCase() + lang.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {showRunButton && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunCode}
              disabled={running}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              style={{
                backgroundColor: 'var(--accent)',
                color: '#fff',
              }}
            >
              {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              Run
            </button>
            {testCases.length > 0 && (
              <button
                onClick={handleRunTests}
                disabled={running}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--success)',
                  color: '#fff',
                }}
              >
                {running ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                Run Tests
              </button>
            )}
          </div>
        )}
      </div>

      {/* Editor */}
      <Editor
        height="400px"
        language={language}
        value={value}
        theme={theme === 'dark' ? 'vs-dark' : 'light'}
        onChange={(val) => onChange(val ?? '')}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
        }}
      />

      {/* Output Panel */}
      {(execResult || testResults) && (
        <div
          className="border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          {/* Output Tabs */}
          <div
            className="flex gap-1 px-3 py-1.5 border-b"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderColor: 'var(--border)',
            }}
          >
            <button
              onClick={() => setActiveOutputTab('output')}
              className="px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer"
              style={{
                backgroundColor: activeOutputTab === 'output' ? 'var(--card-bg)' : 'transparent',
                color: activeOutputTab === 'output' ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              Output
            </button>
            {testResults && (
              <button
                onClick={() => setActiveOutputTab('tests')}
                className="px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer"
                style={{
                  backgroundColor: activeOutputTab === 'tests' ? 'var(--card-bg)' : 'transparent',
                  color: activeOutputTab === 'tests' ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                Tests ({testResults.passed}/{testResults.total})
              </button>
            )}
          </div>

          <div
            className="p-3 max-h-52 overflow-y-auto"
            style={{ backgroundColor: 'var(--card-bg)' }}
          >
            {activeOutputTab === 'output' && execResult && (
              <div className="space-y-2">
                {execResult.timed_out && (
                  <p className="text-xs font-medium" style={{ color: 'var(--danger)' }}>
                    Time limit exceeded
                  </p>
                )}
                {execResult.error && (
                  <p className="text-xs font-medium" style={{ color: 'var(--danger)' }}>
                    {execResult.error}
                  </p>
                )}
                {execResult.stdout && (
                  <pre
                    className="text-xs font-mono whitespace-pre-wrap"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {execResult.stdout}
                  </pre>
                )}
                {execResult.stderr && (
                  <pre
                    className="text-xs font-mono whitespace-pre-wrap"
                    style={{ color: 'var(--danger)' }}
                  >
                    {execResult.stderr}
                  </pre>
                )}
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Exit code: {execResult.exit_code} | Time: {execResult.execution_time_ms}ms
                </p>
              </div>
            )}

            {activeOutputTab === 'tests' && testResults && (
              <div className="space-y-2">
                <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {testResults.passed} of {testResults.total} test cases passed
                </p>
                {testResults.results.map((r, i) => (
                  <div
                    key={r.test_case_id || i}
                    className="rounded border p-2"
                    style={{
                      borderColor: r.passed ? 'var(--success)' : 'var(--danger)',
                      backgroundColor: 'var(--bg-secondary)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {r.passed ? (
                        <CheckCircle size={12} style={{ color: 'var(--success)' }} />
                      ) : (
                        <XCircle size={12} style={{ color: 'var(--danger)' }} />
                      )}
                      <span
                        className="text-xs font-medium"
                        style={{ color: r.passed ? 'var(--success)' : 'var(--danger)' }}
                      >
                        Test {i + 1}: {r.passed ? 'Passed' : 'Failed'}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {r.execution_time_ms}ms
                      </span>
                    </div>
                    {!r.passed && (
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Expected</p>
                          <pre className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>
                            {r.expected_output}
                          </pre>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Got</p>
                          <pre className="text-xs font-mono" style={{ color: 'var(--danger)' }}>
                            {r.actual_output || r.error || '(no output)'}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
