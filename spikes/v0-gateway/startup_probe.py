import os, time, json, resource, subprocess
from deepseek_harness import DeepSeekHarness
HERE = os.path.dirname(os.path.abspath(__file__))
cfg = dict(profile='sdk', patches=(os.path.join(HERE, 'ioc-mcp.patch.yml'),), dsh_home=os.environ['DSH_HOME'], cwd=os.path.join(HERE, 'ws'),
           base_url='http://127.0.0.1:3941', api_key='sk-fake', provider='deepseek-official', model='deepseek-flash',
           env={'IOC_MCP_TOKEN_FILE': os.path.join(HERE, 'secrets/ioc-mcp-token')})
res = {}
for i in range(3):
    t = time.time(); h = DeepSeekHarness(**cfg); h.start(); t1 = time.time()
    pid = h.client._proc.pid
    rss = int(open(f'/proc/{pid}/status').read().split('VmRSS:')[1].split()[0]) // 1024
    r = h.run('你好', session_id=f'probe-{time.time_ns()}'); t2 = time.time()
    res[f'run{i}'] = {'startupMs': int((t1 - t) * 1000), 'firstTurnMs': int((t2 - t1) * 1000), 'rssMB': rss}
    h.close()
print(json.dumps(res))
