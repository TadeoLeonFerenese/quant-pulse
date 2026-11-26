import type { SnapshotCachePort } from '@/domain/integrity/ports';
import type { TrustedSnapshot } from '@/domain/integrity/types';

export class InMemorySnapshotCache implements SnapshotCachePort {
  private readonly store = new Map<string, TrustedSnapshot>();

  get<T>(sourceId: string): Promise<TrustedSnapshot<T> | null> {
    const found = this.store.get(sourceId);
    return Promise.resolve(found ? (found as TrustedSnapshot<T>) : null);
  }

  set<T>(snapshot: TrustedSnapshot<T>): Promise<void> {
    this.store.set(snapshot.sourceId, snapshot);
    return Promise.resolve();
  }
}
