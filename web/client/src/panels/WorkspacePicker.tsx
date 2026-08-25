import { useEffect, useState } from 'react';
import { api } from '../api';
import type { RecentEntry } from '../types';

interface Props {
  onSelect: (dir: string) => void;
}

export function WorkspacePicker({ onSelect }: Props) {
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [manual, setManual] = useState('');
  const [scanDir, setScanDir] = useState('');
  const [scanned, setScanned] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.recents().then(({ recents: r }) => setRecents(r)).catch(() => {});
  }, []);

  const pick = async (dir: string) => {
    setLoading(true);
    setError('');
    try {
      await api.selectWorkspace(dir);
      onSelect(dir);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const doScan = async () => {
    if (!scanDir.trim()) return;
    setLoading(true);
    setError('');
    try {
      const r = await api.scanWorkspaces(scanDir.trim());
      setScanned(r.workspaces);
      if (r.workspaces.length === 0) setError(`在 ${scanDir} 下没有发现工作区（需要 .buildingos/ 标记）`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="picker">
      <div className="picker-card">
        <h1>BuildingOS 控制台</h1>
        <p className="muted">选择一个工作区（带 <code>.buildingos/</code> 标记的目录）。工具不是项目——工作区才是你的租户。</p>

        <section>
          <h2>最近使用</h2>
          {recents.length === 0 ? (
            <p className="muted">还没有最近工作区。</p>
          ) : (
            <ul className="recent-list">
              {recents.map((r) => (
                <li key={r.path}>
                  <button className="recent-btn" disabled={loading} onClick={() => pick(r.path)}>
                    <span className="recent-name">{r.name}</span>
                    <span className="recent-path">{r.path}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2>扫描目录</h2>
          <div className="row">
            <input
              value={scanDir}
              onChange={(e) => setScanDir(e.target.value)}
              placeholder="例如 C:\project\tenants"
              onKeyDown={(e) => e.key === 'Enter' && doScan()}
            />
            <button onClick={doScan} disabled={loading || !scanDir.trim()}>扫描</button>
          </div>
          {scanned.length > 0 && (
            <ul className="recent-list">
              {scanned.map((s) => (
                <li key={s}>
                  <button className="recent-btn" disabled={loading} onClick={() => pick(s)}>
                    <span className="recent-name">{s.split(/[\\/]/).pop()}</span>
                    <span className="recent-path">{s}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2>手动输入路径</h2>
          <div className="row">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="C:\path\to\tenant"
              onKeyDown={(e) => e.key === 'Enter' && manual.trim() && pick(manual.trim())}
            />
            <button onClick={() => manual.trim() && pick(manual.trim())} disabled={loading || !manual.trim()}>打开</button>
          </div>
        </section>

        {error && <div className="error">{error}</div>}
        {loading && <div className="muted">处理中…</div>}
      </div>
    </div>
  );
}
