// 假 dsh（只给用例用）：模拟 `dsh --profile headless "<任务>"` 的行为——
// stderr 写两行「推理」，stdout 写一行最终答复，退出码 0。
const task = process.argv.slice(2).join(' ');
process.stderr.write('[reasoning] 收到任务：' + task + '\n');
process.stderr.write('[reasoning] 准备回答\n');
setTimeout(() => {
  if (process.env.FAKE_DSH_FAIL === '1') { process.stderr.write('boom\n'); process.exit(3); }
  process.stdout.write('答复：' + task + '\n');
  process.exit(0);
}, 30);
