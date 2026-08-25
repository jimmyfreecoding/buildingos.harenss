import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { TreeNode } from '../types';

interface Props {
  workspace: string;
}

export function DocsPanel({ workspace }: Props) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    api.tree(workspace).then(({ tree: t }) => setTree(t)).catch((e) => setStatus(String(e)));
  }, [workspace]);

  const dirs = useMemo(() => {
    const set = new Set<string>();
    for (const n of tree) {
      if (n.isDir) set.add(n.path);
      else {
        const parts = n.path.split('/');
        parts.pop();
        let acc = '';
        for (const p of parts) {
          acc = acc ? `${acc}/${p}` : p;
          set.add(acc);
        }
      }
    }
    return set;
  }, [tree]);

  const files = tree.filter((n) => !n.isDir);

  const openFile = async (f: TreeNode) => {
    try {
      const r = await api.readFile(workspace, f.path);
      setSelected(f.path);
      setContent(r.content);
      setDirty(false);
      setStatus('');
    } catch (e) {
      setStatus(String(e));
    }
  };

  const save = async () => {
    if (!selected) return;
    try {
      await api.writeFile(workspace, selected, content);
      setDirty(false);
      setStatus('已保存');
    } catch (e) {
      setStatus(String(e));
    }
  };

  const visibleFile = (f: TreeNode) => {
    const parts = f.path.split('/');
    return parts.length <= 2 || dirs.has(parts.slice(0, -1).join('/'));
  };

  return (
    <div className="docs">
      <div className="doc-tree">
        <h3>工作区文档</h3>
        <ul>
          {files.filter(visibleFile).map((f) => (
            <li key={f.path}>
              <button className={selected === f.path ? 'active' : ''} onClick={() => openFile(f)}>
                {f.path}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="doc-editor">
        {selected === null ? (
          <p className="muted">选择左侧一个文档查看/编辑（Markdown/YAML，即租户的"大脑"）。</p>
        ) : (
          <>
            <div className="editor-head">
              <code>{selected}</code>
              <button onClick={save} disabled={!dirty}>保存</button>
            </div>
            <textarea
              value={content}
              onChange={(e) => { setContent(e.target.value); setDirty(true); }}
              spellCheck={false}
            />
            {status && <div className="status">{status}</div>}
          </>
        )}
      </div>
    </div>
  );
}
