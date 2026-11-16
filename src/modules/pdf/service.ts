import { Worker } from 'node:worker_threads';
import { join } from 'node:path';
import { PdfAccess, readSnapshot } from './access';
import { LIMITS, validateRequest, type PdfRequest, type PdfResult, type WorkerResponse } from './protocol';

export interface Cancellation {
  readonly isCancellationRequested: boolean;
  onCancellationRequested(listener: () => void): { dispose(): void };
}

export class PdfService {
  private cache = new Map<string, { result: PdfResult; bytes: number }>();
  private cacheSize = 0;
  private queue: Promise<void> = Promise.resolve();
  private workers = new Set<Worker>();
  private disposed = false;
  constructor(private readonly dist: string, readonly access: PdfAccess) {}

  invalidate(): void { this.cache.clear(); this.cacheSize = 0; }

  async run(uri: string, input: PdfRequest, token?: Cancellation, forTool = false): Promise<PdfResult> {
    const request = validateRequest(input);
    let unlock!: () => void;
    const prior = this.queue;
    this.queue = new Promise<void>(resolve => { unlock = resolve; });
    await prior;
    try {
      if (this.disposed || token?.isCancellationRequested) throw new Error('PDF operation cancelled.');
      const path = await this.access.resolve(uri, forTool);
      const snapshot = await readSnapshot(path);
      if (token?.isCancellationRequested) throw new Error('PDF operation cancelled.');
      // Recheck trust and access after IO, before using cached or new content.
      if (forTool) await this.access.resolve(uri, true);
      const key = `${path}:${snapshot.signature}:${JSON.stringify(request)}`;
      const cached = this.cache.get(key);
      if (cached) { this.cache.delete(key); this.cache.set(key, cached); return structuredClone(cached.result); }
      const result = await this.work(snapshot.bytes, request, token);
      if (forTool) await this.access.resolve(uri, true);
      const size = (key.length + JSON.stringify(result).length) * 2;
      if (size <= LIMITS.cacheBytes) {
        while (this.cacheSize + size > LIMITS.cacheBytes && this.cache.size) {
          const first = this.cache.keys().next().value!;
          this.cacheSize -= this.cache.get(first)!.bytes;
          this.cache.delete(first);
        }
        this.cache.set(key, { result: structuredClone(result), bytes: size }); this.cacheSize += size;
      }
      return result;
    } finally { unlock(); }
  }

  private work(bytes: Uint8Array, request: PdfRequest, token?: Cancellation): Promise<PdfResult> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(join(this.dist, 'pdf-worker.mjs'), {
        workerData: { bytes, request, assetRoot: join(this.dist, 'pdfjs') },
        transferList: [bytes.buffer as ArrayBuffer],
        resourceLimits: { maxOldGenerationSizeMb: 256 },
        // PDF.js probes optional canvas support at import time. Text extraction
        // does not need it; keep those rendering-only warnings out of the UI.
        stdout: true,
        stderr: true,
      });
      this.workers.add(worker);
      worker.stdout.resume();
      worker.stderr.resume();
      let settled = false;
      const finish = (error?: Error, result?: PdfResult) => {
        if (settled) return;
        settled = true; clearTimeout(timer); subscription?.dispose();
        this.workers.delete(worker); void worker.terminate();
        if (error) reject(error); else resolve(result!);
      };
      const timer = setTimeout(() => finish(new Error('PDF operation timed out after 30 seconds. Try a smaller document.')), LIMITS.timeoutMs);
      const subscription = token?.onCancellationRequested(() => finish(new Error('PDF operation cancelled.')));
      worker.on('message', (message: WorkerResponse) => message.ok ? finish(undefined, message.result) : finish(new Error(message.error)));
      worker.on('error', error => finish(error instanceof Error ? error : new Error(String(error))));
      worker.on('exit', code => { if (!settled) finish(new Error(`PDF worker exited before completing (code ${code}).`)); });
      if (token?.isCancellationRequested) finish(new Error('PDF operation cancelled.'));
    });
  }

  dispose(): void {
    this.disposed = true; this.invalidate(); this.access.dispose();
    for (const worker of this.workers) void worker.terminate();
    this.workers.clear();
  }
}
