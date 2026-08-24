/**
 * @buildingos/adapter-codex — Codex (OpenAI Codex CLI) adapter.
 * compile(): TenantDocs → Codex engine view (render.ts).
 * run(): event bridge — pending the codex mcp-server validation (experimental, adapter-contract §9.2).
 */
import type {
  AgentEvent,
  CompileOptions,
  ConformanceReport,
  EngineConfig,
  EngineView,
  HarnessAdapter,
  RunRequest,
  TenantDocs,
  ToolDescriptor,
  AdapterStatus,
} from '@buildingos/normalizer';
import { renderCodexView } from './render.js';

export class CodexAdapter implements HarnessAdapter {
  readonly engine = 'codex' as const;

  compile(docs: TenantDocs, opts?: CompileOptions): EngineView {
    return {
      engine: 'codex',
      files: renderCodexView(docs, opts?.assets),
      runtimeConfig: {
        // In-memory mode via `codex mcp-server` (experimental, commit d21794d6): thread/start,
        // turn/start, config, model/list, collaborationMode/list — validated before the run() bridge.
        bridge: 'codex mcp-server',
        model: docs.config.model,
      },
    };
  }

  run(_req: RunRequest, _cfg: EngineConfig): AsyncIterable<AgentEvent> {
    throw new Error(
      'CodexAdapter.run: not implemented yet — bridge form (codex mcp-server, experimental) is an M1 implementation decision (adapter-contract §9.2)',
    );
  }

  tools(): ToolDescriptor[] {
    return [
      { name: 'mcp://telemetry/*', description: 'network telemetry MCP tools (registered per tenant config.toml)' },
    ];
  }

  status(): AdapterStatus {
    return {
      engine: 'codex',
      healthy: true,
      capabilities: ['skills', 'AGENTS.md', 'mcp-server', 'memories-native'],
    };
  }

  selfcheck(): ConformanceReport[] {
    return [
      { dimension: 'interface', passed: true, details: 'adapter-contract/v1 implemented; run() pending bridge validation' },
      { dimension: 'behavior', passed: false, details: 'golden task G1 compile parity verified; engine run requires the run() bridge' },
    ];
  }
}

export const codexAdapter = new CodexAdapter();
export { renderCodexView } from './render.js';
