# V0-4 驱动：模拟 gateway 通过 DSH SDK 运行时（JSON-RPC over stdio）驱动会话。
import json, os, sys, time, threading
from deepseek_harness import DeepSeekHarness
from deepseek_harness.client import HarnessClient
from pydantic import BaseModel

HERE = os.path.dirname(os.path.abspath(__file__))
os.environ['IOC_MCP_TOKEN_FILE'] = os.path.join(HERE, 'secrets/ioc-mcp-token')
cfg = dict(profile='sdk', patches=(os.path.join(HERE, 'ioc-mcp.patch.yml'),), dsh_home=os.environ['DSH_HOME'],
           cwd=os.path.join(HERE, 'ws'), base_url='http://127.0.0.1:3941', api_key='sk-fake',
           provider='deepseek-official', model='deepseek-flash', env={'IOC_MCP_TOKEN_FILE': os.environ['IOC_MCP_TOKEN_FILE']})
os.makedirs(cfg['cwd'], exist_ok=True)
out = {}
class Any(BaseModel):
    model_config = {'extra': 'allow'}

with DeepSeekHarness(**cfg) as h:
    t = time.time()
    r = h.run('请写一个今日能耗的 KPI 块', session_id='ioc-u1-p1-s1')
    out['run1'] = {'ms': int((time.time() - t) * 1000), 'final': r.final_response, 'finish': r.finish_reason,
                   'eventTypes': sorted({e.get('type') for e in r.events}), 'notifMethods': sorted({n.method for n in r.notifications})}
    tool_events = [e for e in r.events if 'tool' in str(e.get('type'))]
    out['toolEvents'] = [json.dumps(e, ensure_ascii=False)[:400] for e in tool_events[:4]]
    # 探测可用的 JSON-RPC 方法（取消 / 会话列表）
    probes = {}
    for m, p in [('session/cancel', {'sessionId': 'ioc-u1-p1-s1'}), ('session/interrupt', {'sessionId': 'ioc-u1-p1-s1'}),
                 ('session/list', {}), ('session/abort', {'sessionId': 'ioc-u1-p1-s1'}), ('rpc/discover', {})]:
        try:
            res = h.client.request(m, p, response_model=Any, timeout_seconds=5)
            probes[m] = 'OK ' + json.dumps(res.model_dump(), ensure_ascii=False)[:200]
        except Exception as e:
            probes[m] = type(e).__name__ + ': ' + str(e)[:160]
    out['probes'] = probes
    print(json.dumps(out, ensure_ascii=False, indent=1), flush=True)
# 进程重启后续接同一会话（验证持久化恢复）
with DeepSeekHarness(**cfg) as h:
    for m, p in [('session/resume', {'sessionId': 'ioc-u1-p1-s1'}), ('session/load', {'sessionId': 'ioc-u1-p1-s1'})]:
        try:
            res = h.client.request(m, p, response_model=Any, timeout_seconds=10); out.setdefault('resumeProbe', {})[m] = 'OK ' + json.dumps(res.model_dump(), ensure_ascii=False)[:300]; break
        except Exception as e:
            out.setdefault('resumeProbe', {})[m] = type(e).__name__ + ': ' + str(e)[:200]
    from deepseek_harness.api import Session
    r2 = Session(h, 'ioc-u1-p1-s1').run('继续：刚才写了什么？')
    out['resume'] = {'final': r2.final_response, 'finish': r2.finish_reason}
print(json.dumps(out, ensure_ascii=False, indent=1))
