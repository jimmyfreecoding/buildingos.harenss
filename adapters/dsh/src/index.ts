/**
 * @buildingos/adapter-dsh — DSH (DeepSeek Harness) adapter.
 * compile(): TenantDocs → DSH engine view (render.ts).
 * run(): event bridge — pending the ACP vs. in-process cordis decision (adapter-contract §9).
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
import { renderDshView } from './render.js';

export class DshAdapter implements HarnessAdapter {
  readonly engine = 'dsh' as const;

  compile(docs: TenantDocs, opts?: CompileOptions): EngineView {
    return {
      engine: 'dsh',
      files: renderDshView(docs, opts?.assets),
      runtimeConfig: {
        // cordis.yml rows for mcp-client / system-prompt assembly — calibration point C3,
        // finalized when the run() bridge lands.
        cordisRows: docs.config.mcpServers.map((m) => ({
          name: m.name,
          transport: m.transport,
          command: m.command,
          url: m.url,
        })),
        sandbox: docs.config.sandbox,
        approval: docs.config.approval,
      },
    };
  }

  run(_req: RunRequest, _cfg: EngineConfig): AsyncIterable<AgentEvent> {
    throw new Error(
      'DshAdapter.run: not implemented yet — bridge form (ACP vs. in-process cordis) is an M1 implementation decision (adapter-contract §9.1)',
    );
  }

  tools(): ToolDescriptor[] {
    return [
      { name: 'mcp://telemetry/*', description: 'network telemetry MCP tools (registered per tenant runtime.yaml)' },
    ];
  }

  status(): AdapterStatus {
    return {
      engine: 'dsh',
      healthy: true,
      capabilities: ['skills', 'system-prompt-sections', 'mcp-client', 'warn-and-skip'],
    };
  }

  selfcheck(): ConformanceReport[] {
    return [
      { dimension: 'interface', passed: true, details: 'adapter-contract/v1 implemented; run() pending bridge decision' },
      { dimension: 'behavior', passed: false, details: 'golden task G1 compile parity verified; engine run requires the run() bridge' },
    ];
  }
}

export const dshAdapter = new DshAdapter();
export { renderDshView } from './render.js';
