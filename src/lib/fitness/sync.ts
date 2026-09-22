import { fitnessSchema } from "./storage.ts";
import type { FitnessData } from "./model.ts";
export type FitnessUpdate = (change: (data: FitnessData) => FitnessData) => Promise<boolean>;
export type CloudFitness = { data: FitnessData; revision: number };
export interface FitnessRepository {
  load(): Promise<CloudFitness>;
  save(data: FitnessData, revision: number): Promise<CloudFitness>;
}
export type SyncState = { data: FitnessData; pending: number; error: string; ready: boolean };
// One ordered queue per account; success requires the server acknowledgement.
export class FitnessSync {
  private confirmed: CloudFitness;
  private state: SyncState;
  private stopped = false;
  private writing = false;
  private queue: { data: FitnessData; resolve: (saved: boolean) => void }[] = [];
  private repository: FitnessRepository;
  private publish: (state: SyncState) => void;
  constructor(
    repository: FitnessRepository,
    initial: CloudFitness,
    publish: (state: SyncState) => void,
  ) {
    this.repository = repository;
    this.publish = publish;
    this.confirmed = initial;
    this.state = { data: initial.data, pending: 0, error: "", ready: true };
  }
  private emit() {
    if (!this.stopped) this.publish({ ...this.state });
  }
  update: FitnessUpdate = async (change) => {
    if (this.stopped || !this.state.ready) return false;
    let next: FitnessData;
    try {
      next = fitnessSchema.parse(change(structuredClone(this.state.data)));
    } catch {
      this.state.error = "輸入格式無效，尚未儲存。";
      this.emit();
      return false;
    }
    const saved = new Promise<boolean>((resolve) => this.queue.push({ data: next, resolve }));
    this.state = { data: next, pending: this.queue.length, error: "", ready: true };
    this.emit();
    void this.flush();
    return saved;
  };
  private async flush() {
    if (this.writing) return;
    this.writing = true;
    while (this.queue.length && !this.stopped) {
      const item = this.queue[0]!;
      try {
        this.confirmed = await this.repository.save(item.data, this.confirmed.revision);
        if (this.stopped) break;
        this.queue.shift();
        item.resolve(true);
        this.state.pending = this.queue.length;
        if (!this.queue.length) this.state.data = this.confirmed.data;
        this.emit();
      } catch (error) {
        if (this.stopped) break;
        this.queue.splice(0).forEach((item) => item.resolve(false));
        this.state = {
          data: this.confirmed.data,
          pending: 0,
          ready: false,
          error: `${error instanceof Error ? error.message : "雲端寫入失敗。"} 未確認的變更已回復，請重新載入雲端資料後重試。`,
        };
        this.emit();
        break;
      }
    }
    this.writing = false;
  }
  stop() {
    this.stopped = true;
    this.queue.splice(0).forEach((item) => item.resolve(false));
  }
}

