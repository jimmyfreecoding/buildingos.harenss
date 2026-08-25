import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { DevStatus } from '../types';

interface Props {
  workspace: string;
}

export function DevPanel({ workspace }: Props) {
  const [status, setStatus] = useState<DevStatus | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [output, setOutput] = useState('');
  const [pgPort, setPgPort] = useState('');

  const refresh = useCallback(async () => {
    try {
      setStatus(await api.devStatus(workspace));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [workspace]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  const up = async () => {
    setBusy('up');
    setOutput('');
    setError('');
    try {
      const r = await api.devUp(workspace, pgPort || undefined);
      setOutput(r.output);
      if (!r.ok) setError(r.error ?? 'docker compose up 失败');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  };

  const down = async (volumes: boolean) => {
    setBusy('down');
    setOutput('');
    setError('');
    try {
      const r = await api.devDown(workspace, volumes);
      setOutput(r.output);
      if (!r.ok) setError(r.error ?? 'docker compose down 失败');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="panel">
      <h2>开发环境（docker compose）</h2>
      <p className="muted">buildingos-runtime（CLI 容器，/workspace 挂载）+ postgres。密码在 .env（D21）。</p>

      <section>
        <h3>控制</h3>
        <div className="row">
          <label>PG 端口（5432 被占用时填，如 55432）</label>
          <input value={pgPort} onChange={(e) => setPgPort(e.target.value)} placeholder="55432" style={{ width: 90 }} />
          <button onClick={up} disabled={busy !== '' || !status?.composeExists}>{busy === 'up' ? '启动中…' : 'docker compose up'}</button>
          <button onClick={() => down(false)} disabled={busy !== '' || !status?.composeExists}>{busy === 'down' ? '停止中…' : 'down'}</button>
          <button onClick={() => down(true)} disabled={busy !== '' || !status?.composeExists}>down -v（删数据）</button>
        </div>
      </section>

      <section>
        <h3>状态</h3>
        {!status ? <p className="muted">加载中…</p> : !status.composeExists ? (
          <div className="muted">工作区没有 docker-compose.yml——先跑向导（init）生成开发环境。</div>
        ) : (
          <table className="dev-table">
            <thead>
              <tr><th>容器</th><th>服务</th><th>状态</th><th>端口</th></tr>
            </thead>
            <tbody>
              {status.containers.length === 0 && (
                <tr><td colSpan={4} className="muted">没有运行中的容器（点击 docker compose up）</td></tr>
              )}
              {status.containers.map((c) => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td>{c.service}</td>
                  <td>{c.status}</td>
                  <td>{c.ports}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {status?.error && <div className="error">{status.error}</div>}
      </section>

      {output && (
        <section>
          <h3>输出</h3>
          <pre className="output">{output}</pre>
        </section>
      )}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
