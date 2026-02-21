import { Outlet } from 'react-router-dom';
import ThemeToggle from '../common/ThemeToggle';
import { useBrandingStore } from '../../store/brandingStore';

export default function CandidateLayout() {
  const orgName = useBrandingStore((s) => s.organizationName);
  const logoUrl = useBrandingStore((s) => s.logoUrl);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <header
        className="h-14 flex items-center justify-between px-6 border-b"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex items-center gap-3">
          {logoUrl && (
            <img
              src={logoUrl}
              alt={orgName || 'Organization'}
              className="h-7 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {orgName || 'Assessment Platform'}
          </h1>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
