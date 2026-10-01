// Waits until the API server answers, so the client starts without a burst
// of proxy errors. Usage: node scripts/wait-for-server.mjs [url] [timeoutSec]
const url = process.argv[2] ?? `http://127.0.0.1:${process.env.PORT ?? 3000}/health`;
const timeoutMs = Number(process.argv[3] ?? 180) * 1000;
const started = Date.now();

process.stdout.write(`Waiting for the server at ${url} ...\n`);
while (Date.now() - started < timeoutMs) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(2000) });
    process.stdout.write(`Server is up after ${Math.round((Date.now() - started) / 1000)}s.\n`);
    process.exit(0);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
process.stderr.write(`Server did not answer within ${timeoutMs / 1000}s: see the [server] logs.\n`);
process.exit(1);
