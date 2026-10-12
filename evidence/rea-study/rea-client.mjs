// Owned stdio MCP harness. Saves exact requests, responses and stderr; no game code.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
const [entry, planFile, output] = process.argv.slice(2);
mkdirSync(output, { recursive: true });
const child = spawn(process.execPath, [entry, 'mcp'], { cwd: process.cwd(), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
writeFileSync(path.join(output, 'server.json'), JSON.stringify({ entry, cwd: process.cwd(), pid: child.pid, node: process.version, started: new Date().toISOString() }, null, 2));
child.stderr.on('data', d => appendFileSync(path.join(output, 'stderr.txt'), d));
writeFileSync(path.join(output, 'stderr.txt'), '');
const pending = new Map(); let nextId = 0;
createInterface({ input: child.stdout }).on('line', line => {
  appendFileSync(path.join(output, 'stdout.jsonl'), line + '\n');
  try { const value = JSON.parse(line); const waiter = pending.get(value.id); if (waiter) { pending.delete(value.id); waiter.resolve(value); } } catch {}
});
child.on('exit', (code, signal) => {
  appendFileSync(path.join(output, 'lifecycle.jsonl'), JSON.stringify({ event: 'exit', code, signal, time: new Date().toISOString() }) + '\n');
  for (const waiter of pending.values()) waiter.reject(new Error(`REA exited code=${code} signal=${signal}`));
  pending.clear();
});
async function request(method, params, timeout = 900000) {
  const id = ++nextId; const value = { jsonrpc: '2.0', id, method, params };
  appendFileSync(path.join(output, 'requests.jsonl'), JSON.stringify(value) + '\n');
  let timer;
  try { return await new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); timer = setTimeout(() => { pending.delete(id); reject(new Error(`Request ${method} timed out after ${timeout}ms`)); }, timeout); child.stdin.write(JSON.stringify(value) + '\n'); }); }
  finally { clearTimeout(timer); }
}
try {
  const initialized = await request('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'owner-rea-diagnostic', version: '1.0' } }, 120000);
  writeFileSync(path.join(output, 'initialize.json'), JSON.stringify(initialized, null, 2));
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const catalog = await request('tools/list', {} , 30000);
  writeFileSync(path.join(output, 'tools.json'), JSON.stringify(catalog, null, 2));
  console.log(JSON.stringify({ initialized: initialized.result?.serverInfo, tools: catalog.result?.tools?.length, error: catalog.error }));
  const results = {};
  for (const step of JSON.parse(readFileSync(planFile, 'utf8').replace(/^\uFEFF/, ''))) {
    let args = step.arguments;
    for (const [field, label] of Object.entries(step.references ?? {})) {
      const source = results[label];
      args = { ...args, [field]: { kind: 'retained-evidence', evidence_id: source.evidence_id ?? source.error?.details?.reported_limits?.evidence_id } };
    }
    if (step.applicationFrom) args = { ...args, application: results[step.applicationFrom] };
    const start = Date.now(); console.log(`START ${step.label} ${step.name}`);
    const result = await request('tools/call', { name: step.name, arguments: args }, step.timeout_ms ?? 900000);
    writeFileSync(path.join(output, `${step.label}.json`), JSON.stringify(result, null, 2));
    const content = result.result?.content?.find(c => c.type === 'text')?.text;
    let parsed; try { parsed = JSON.parse(content); } catch {}
    results[step.label] = parsed;
    console.log(JSON.stringify({ label: step.label, elapsed_ms: Date.now() - start, isError: result.result?.isError, error: result.error, bytes: JSON.stringify(result).length, preview: content?.slice(0, 500) }));
  }
} catch (e) {
  writeFileSync(path.join(output, 'client-error.txt'), e.stack); console.error(e.stack); process.exitCode = 1;
} finally { child.stdin.end(); setTimeout(() => child.kill(), 1500).unref(); }
