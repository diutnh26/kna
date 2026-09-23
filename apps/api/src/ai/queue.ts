import { AI } from "./config";

/**
 * One generation at a time.
 *
 * Not a throughput optimisation — a correctness one. There is a single
 * GPU with 4 GB on it, holding a ~1.9 GB chat model beside a ~1.2 GB
 * embedder. Two concurrent generations do not run at half speed each;
 * they contend for VRAM, and Ollama's response is to evict a model and
 * reload it, so the pair can take longer than the same two requests run
 * back to back.
 *
 * Requests beyond `queueLimit` are refused rather than queued. A visitor
 * told "busy, try again" after a moment has been treated better than one
 * left watching a spinner for ninety seconds behind four other people.
 */
export class Gate {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(
    private readonly limit = AI.concurrency,
    private readonly queueLimit = AI.queueLimit
  ) {}

  /** Current queue depth, for the "busy" reply and for tests. */
  get depth() {
    return this.waiting.length;
  }

  /**
   * Runs `job` once a slot is free.
   *
   * Throws `GateFullError` immediately when the queue is already at its
   * limit, so the caller can answer rather than hang.
   */
  async run<T>(job: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      if (this.waiting.length >= this.queueLimit) {
        throw new GateFullError();
      }
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }

    this.active++;
    try {
      return await job();
    } finally {
      this.active--;
      // Hand the slot on before returning, so a queued caller starts
      // without waiting for this promise chain to unwind.
      this.waiting.shift()?.();
    }
  }
}

export class GateFullError extends Error {
  constructor() {
    super("The assistant is busy.");
    this.name = "GateFullError";
  }
}

/** The process-wide gate. One GPU, one gate. */
export const generationGate = new Gate();
