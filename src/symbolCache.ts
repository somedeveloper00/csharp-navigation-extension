export interface VersionedCacheEntry<T> {
  readonly version: number;
  readonly value: Promise<T>;
}

/**
 * Keeps one successfully loaded value for each resource and version. In-flight
 * loads are shared as well, so commands issued close together do not duplicate
 * provider requests.
 */
export class VersionedCache<T> {
  private readonly entries = new Map<string, VersionedCacheEntry<T>>();

  async get(key: string, version: number, load: () => Promise<T>, cacheable: (value: T) => boolean = () => true): Promise<T> {
    const existing = this.entries.get(key);
    if (existing?.version === version) return existing.value;

    const value = load();
    const entry = { version, value };
    this.entries.set(key, entry);
    try {
      const resolved = await value;
      // Empty provider responses during language-server startup are usually
      // transient. Let the next navigation command try the provider again.
      if (!cacheable(resolved) && this.entries.get(key) === entry) this.entries.delete(key);
      return resolved;
    } catch (error) {
      if (this.entries.get(key) === entry) this.entries.delete(key);
      throw error;
    }
  }

  delete(key: string): void { this.entries.delete(key); }
  clear(): void { this.entries.clear(); }
}
