import { useState } from 'react';
import { api } from '../api';

interface Props {
  workspace: string;
}

const ENGINES = [
  { value: 'dsh', label: 'DeepSeek Harness (DSH)' },
  { value: 'codex', label: 'OpenAI Codex harness' },
];

const MODELS: Record<string, string[]> = {
  dsh: ['deepseek-chat', 'deepseek-reasoner', 'gpt-4o'],
  codex: ['gpt-5.2-codex', 'gpt-5.1-codex-max', 'gpt-4o'],
};

export function WizardPanel({ workspace }: Props) {
  const [language, setLanguage] = useState<'zh' | 'en'>('zh');
  const [engine, setEngine] = useState<'dsh' | 'codex'>('dsh');
  const [model, setModel] = useState('gpt-4o');
  const [customModel, setCustomModel] = useState('');
  const [modelToken, setModelToken] = useState('');
  const [gitToken, setGitToken] = useState('');
  const [dir, setDir] = useState(workspace);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setStatus('');
    try {
      const r = await api.wizard({
        dir: dir.trim() || workspace,
        language,
        engine,
        model: model === '__custom__' ? '__custom__' : model,
        customModel: model === '__custom__' ? customModel : undefined,
        modelToken,
        gitToken: gitToken || undefined,
      });
      setStatus(r.ok ? `向导完成：engine=${r.engine} model=${r.model}` : '向导未通过（校验失败）');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h2>首启向导（init）</h2>
      <p className="muted">步骤 0-7：语言 → 引擎 → 模型 → 凭证 → 脚手架 → 校验。token 只写进 .env（D21，绝不进 Git）。</p>

      <label>5. 目标目录（脚手架位置）</label>
      <input value={dir} onChange={(e) => setDir(e.target.value)} />
      <p className="hint">这个目录当前还不是租户——执行向导后会在其中生成 <code>.buildingos/</code>、<code>knowledge/</code>、<code>docker-compose.yml</code> 等。</p>

      <label>0. 语言</label>
      <select value={language} onChange={(e) => setLanguage(e.target.value as 'zh' | 'en')}>
        <option value="zh">中文</option>
        <option value="en">English</option>
      </select>

      <label>1. 引擎</label>
      <select value={engine} onChange={(e) => { setEngine(e.target.value as 'dsh' | 'codex'); setModel(MODELS[e.target.value as 'dsh' | 'codex'][0] ?? 'gpt-4o'); }}>
        {ENGINES.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
      </select>

      <label>2. 模型</label>
      <select value={model} onChange={(e) => setModel(e.target.value)}>
        {MODELS[engine].map((m) => <option key={m} value={m}>{m}</option>)}
        <option value="__custom__">其他（手动输入）</option>
      </select>
      {model === '__custom__' && (
        <input value={customModel} onChange={(e) => setCustomModel(e.target.value)} placeholder="模型句柄" />
      )}

      <label>3. 模型 API token（→ .env）</label>
      <input type="password" value={modelToken} onChange={(e) => setModelToken(e.target.value)} placeholder="sk-…" />

      <label>4. Git token（可留空跳过）</label>
      <input type="password" value={gitToken} onChange={(e) => setGitToken(e.target.value)} placeholder="留空 = 跳过" />

      <div className="actions">
        <button onClick={run} disabled={busy || !modelToken.trim()}>执行向导</button>
      </div>
      {status && <div className="status">{status}</div>}
      {busy && <div className="muted">执行中…（写文档、.env、compose，然后校验）</div>}
    </div>
  );
}
