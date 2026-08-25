import { useEffect, useState } from 'react';
import { api } from '../api';
import type { FsList, RecentEntry } from '../types';

interface Props {
  onSelect: (dir: string, isWorkspace: boolean) => void;
}

/**
 * The first step: browse this computer's folders and pick one.
 *  - a folder that's already a tenant (.buildingos/) → open it
 *  - any other folder → the app offers to initialize one here
 * (No manual-path requirement, no "must be .buildingos first".)
 */
export function WorkspacePicker({ onSelect }: Props) {
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [current, setCurrent] = useState<FsList | null>(null);
  const [roots, setRoots] = useState<string[]>([]);
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadDir = async (dir?: string) => {
    setLoading(true);
    setError('');
    try {
      const list = await api.fsList(dir);
      setCurrent(list);
      setAddress(list.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.recents().then(({ recents: r }) => setRecents(r)).catch(() => {});
    api.fsRoots().then(({ roots: r }) => {
      setRoots(r);
      // Start browsing at the first drive root (e.g. C:\ on Windows).
      loadDir(r[0]);
    }).catch(() => {});
  }, []);

  const pick = async (dir: string) => {
    setLoading(true);
    setError('');
    try {
      const r = await api.selectWorkspace(dir);
      onSelect(r.path, r.isWorkspace);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const goTo = (dir: string) => loadDir(dir);

  return (
    <div className="picker">
      <div className="picker-card picker-wide">
        <h1>BuildingOS 控制台</h1>
        <p className="muted">第一步：选择这台电脑上的一个文件夹作为工作区。若它已是租户（含 <code>.buildingos/</code>）直接打开；否则可在这里初始化一个。</p>

        <section>
          <h2>浏览文件夹</h2>

          <div className="row fs-row">
            <span className="fs-label">位置</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && address.trim() && goTo(address.trim())}
              spellCheck={false}
            />
            <button onClick={() => address.trim() && goTo(address.trim())}>前往</button>
            {current?.parent && <button className="secondary" onClick={() => goTo(current.parent as string)}>↑ 上级</button>}
          </div>

          <div className="fs-roots">
            {roots.map((r) => <button key={r} className="secondary" onClick={() => goTo(r)}>{r}</button>)}
          </div>

          {current && (
            <div className="fs-list">
              <div className="fs-current">
                <code>{current.path}</code>
                {current.isWorkspace && <span className="badge">租户</span>}
                <button className="primary" onClick={() => pick(current.path)} disabled={loading}>选择此文件夹</button>
              </div>
              {current.dirs.length === 0 ? (
                <p className="muted">这个文件夹下没有子文件夹可浏览。</p>
              ) : (
                <ul className="fs-entries">
                  {current.dirs.map((d) => (
                    <li key={d.path}>
                      <button className={d.isWorkspace ? 'entry ws' : 'entry'} onClick={() => goTo(d.path)}>
                        <span className="entry-name">{d.name}</span>
                        {d.isWorkspace && <span className="badge">租户</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {recents.length > 0 && (
          <section>
            <h2>最近使用</h2>
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
          </section>
        )}

        {error && <div className="error">{error}</div>}
        {loading && <div className="muted">加载中…</div>}
      </div>
    </div>
  );
}
