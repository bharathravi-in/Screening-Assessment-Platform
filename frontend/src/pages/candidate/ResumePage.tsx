import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, Loader2, SkipForward, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

const ACCEPTED_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export default function ResumePage() {
  const navigate = useNavigate();

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      const errorCode = rejection.errors?.[0]?.code;
      if (errorCode === 'file-too-large') {
        toast.error('File size must be less than 5 MB.');
      } else if (errorCode === 'file-invalid-type') {
        toast.error('Only PDF, DOC, and DOCX files are accepted.');
      } else {
        toast.error('Invalid file. Please select a valid resume file.');
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    maxFiles: 1,
    multiple: false,
  });

  const handleRemoveFile = () => {
    setFile(null);
  };

  const handleSkip = () => {
    navigate('/test/active');
  };

  const handleContinue = async () => {
    if (!file) {
      navigate('/test/active');
      return;
    }

    setUploading(true);
    try {
      // TODO: Implement resume upload API call when backend endpoint is ready
      // const formData = new FormData();
      // formData.append('resume', file);
      // await testService.uploadResume(formData);
      toast.success('Resume uploaded successfully.');
      navigate('/test/active');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      toast.error(detail || 'Failed to upload resume. You may skip and continue.');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      className="flex-1 flex items-center justify-center px-4 py-8"
      style={{ minHeight: 'calc(100vh - 56px)' }}
    >
      <div
        className="w-full max-w-lg rounded-xl p-8"
        style={{
          backgroundColor: 'var(--card-bg)',
          boxShadow: 'var(--card-shadow)',
          border: '1px solid var(--border)',
        }}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            Upload Resume
          </h1>
          <p
            className="mt-2 text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            Optionally upload your resume for the recruiter to review alongside
            your assessment results.
          </p>
        </div>

        {/* Dropzone */}
        {!file ? (
          <div
            {...getRootProps()}
            className="rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors"
            style={{
              borderColor: isDragActive ? 'var(--accent)' : 'var(--border)',
              backgroundColor: isDragActive
                ? 'rgba(59, 130, 246, 0.05)'
                : 'var(--bg-secondary)',
            }}
          >
            <input {...getInputProps()} />
            <Upload
              size={36}
              className="mx-auto mb-3"
              style={{
                color: isDragActive ? 'var(--accent)' : 'var(--text-muted)',
              }}
            />
            <p
              className="text-sm font-medium mb-1"
              style={{ color: 'var(--text-primary)' }}
            >
              {isDragActive
                ? 'Drop your file here'
                : 'Drag & drop your resume here'}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              or click to browse. PDF, DOC, DOCX up to 5 MB
            </p>
          </div>
        ) : (
          <div
            className="rounded-lg p-4 flex items-center gap-3"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            <div
              className="p-2.5 rounded-lg shrink-0"
              style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
            >
              <FileText size={22} style={{ color: '#3b82f6' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-medium truncate"
                style={{ color: 'var(--text-primary)' }}
              >
                {file.name}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {formatFileSize(file.size)}
              </p>
            </div>
            <button
              onClick={handleRemoveFile}
              className="p-1.5 rounded-lg transition-colors cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
              title="Remove file"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSkip}
            disabled={uploading}
            className="flex-1 py-3 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            <SkipForward size={16} />
            Skip
          </button>
          <button
            onClick={handleContinue}
            disabled={uploading}
            className="flex-1 py-3 rounded-lg text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {uploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <ArrowRight size={16} />
                Continue
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
