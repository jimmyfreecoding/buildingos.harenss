import { useEffect, useState } from 'react';
import { api } from './api';
import type { TreeNode } from './types';
import { WorkspacePicker } from './panels/WorkspacePicker';
import { DocsPanel } from './panels/DocsPanel';
import { WizardPanel } from './panels/WizardPanel';
import { PipelinePanel } from './panels/PipelinePanel';
import { DevPanel } from './panels/DevPanel';

type Tab = 'docs' | 'wizard' | 'pipeline' | 'dev';

export function App() {
  const [workspace, setWorkspace] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [tab, setTab] = useState<Tab>('docs');

  // Restore the most recent workspace on load.
  useEffect(() => {
    api.recents().then(({ recents }) => {
      if (recents.length > 0) {
        setWorkspace(recents[0].path);
        setWorkspaceName(recents[0].name);
      }
    }).catch(() => {});
  }, []);

  const select = (dir: string) => {
    setWorkspace(dir);
    setWorkspaceName(dir.split(/[\\/]/).pop() ?? dir);
    setTab('docs');
  };

  if (!workspace) {
    return <WorkspacePicker onSelect={select} />;
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <strong>BuildingOS</strong>
          <span className="ws-name" title={workspace}>{workspaceName}</span>
        </div>
        <nav className="tabs">
          <button className={tab === 'docs' ? 'active' : ''} onClick={() => setTab('docs')}>文档</button>
          <button className={tab === 'wizard' ? 'active' : ''} onClick={() => setTab('wizard')}>向导</button>
          <button className={tab === 'pipeline' ? 'active' : ''} onClick={() => setTab('pipeline')}>校验/编译/一致性</button>
          <button className={tab === 'dev' ? 'active' : ''} onClick={() => setTab('dev')}>开发环境</button>
        </nav>
        <div className="sidebar-footer">
          <button className="switch-ws" onClick={() => setWorkspace(null)}>切换工作区</button>
        </div>
      </aside>
      <main className="content">
        {tab === 'docs' && <DocsPanel workspace={workspace} />}
        {tab === 'wizard' && <WizardPanel workspace={workspace} />}
        {tab === 'pipeline' && <PipelinePanel workspace={workspace} />}
        {tab === 'dev' && <DevPanel workspace={workspace} />}
      </main>
    </div>
  );
}
