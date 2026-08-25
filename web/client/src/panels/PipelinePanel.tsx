import { useState } from 'react';
import { api } from '../api';
import type { CompileResult, ConformanceResult, Diagnostic } from '../types';

interface Props {
  workspace: string;
}

export function PipelinePanel({ workspace }: Props) {
  const [validate, setValidate] = useState<{ ok: boolean; diagnostics: Diagnostic[] } | null>(null);
  const [compile, setCompile] = useState<CompileResult | null>(null);
  const [conformance, setConformance] = useState<ConformanceResult | null>(null);
  const [engine, setEngine] = useState<'dsh' | 'codex'>('dsh');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const runValidate = async () => {
    setBusy('validate');
    setError('');
    try {
      setValidate(await api.validate(workspace));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  };

  const runCompile = async () => {
    setBusy('compile');
    setError('');
    try {
      setCompile(await api.compile(workspace, engine));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  };

  const runConformance = async () => {
    setBusy('conformance');
    setError('');
    try {
      setConformance(await api.conformance(workspace));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="panel">
      <h2>流水线</h2>
      <p className="muted">文档模型 → 引擎视图 → 黄金比对（G1）。</p>

      <section>
        <h3>1. 校验（validate）</h3>
        <button onClick={runValidate} disabled={busy !== ''}>{busy === 'validate' ? '运行中…' : '运行校验'}</button>
        {validate && (
          <div className={validate.ok ? 'ok' : 'error'}>
            {validate.ok ? `校验通过（${validate.diagnostics.filter((d) => d.severity !== 'info').length} 条 warning/info）` : `校验失败（${validate.diagnostics.filter((d) => d.severity === 'error').length} 个 error）`}
            <ul className="diag">
              {validate.diagnostics.map((d, i) => (
                <li key={i} className={`sev-${d.severity}`}>
                  [{d.severity.toUpperCase()}] {d.code} {d.file ? `(${d.file})` : ''} — {d.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h3>2. 编译（compile）</h3>
        <div className="row">
          <select value={engine} onChange={(e) => setEngine(e.target.value as 'dsh' | 'codex')}>
            <option value="dsh">dsh</option>
            <option value="codex">codex</option>
          </select>
          <button onClick={runCompile} disabled={busy !== ''}>{busy === 'compile' ? '编译中…' : '渲染引擎视图'}</button>
        </div>
        {compile && (
          <div className="ok">
            已写 {compile.files.length} 个文件 → <code>{compile.outDir}</code>
            <ul className="diag">
              {compile.files.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h3>3. 一致性（conformance G1）</h3>
        <button onClick={runConformance} disabled={busy !== ''}>{busy === 'conformance' ? '运行中…' : '运行一致性'}</button>
        {conformance && (
          <div>
            {!conformance.baseline && <div className="muted">{conformance.note ?? '无 golden 基线——先编译'}</div>}
            <ul className="diag">
              {conformance.results.map((r, i) => {
                const tag = r.skipped ? 'SKIP' : r.passed ? 'PASS' : 'FAIL';
                return (
                  <li key={i} className={`sev-${r.skipped ? 'info' : r.passed ? 'info' : 'error'}`}>
                    [{tag}] {r.task} {r.engine ? `(${r.engine})` : ''}
                    {r.details?.map((d, j) => <div key={j} className="detail">{d}</div>)}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {error && <div className="error">{error}</div>}
    </div>
  );
}
