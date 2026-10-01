/**
 * Counts observers per symbol so a symbol stays subscribed upstream until the
 * last observer of it leaves.
 */
export class SymbolRefCounter {
  private readonly counts = new Map<string, number>();

  /** Registers observers; returns the symbols that are newly watched. */
  acquire(symbols: string[]): string[] {
    return symbols.filter((symbol) => {
      const count = this.counts.get(symbol) ?? 0;
      this.counts.set(symbol, count + 1);
      return count === 0;
    });
  }

  /** Removes observers; returns the symbols nobody watches anymore. */
  release(symbols: string[]): string[] {
    return symbols.filter((symbol) => {
      const count = (this.counts.get(symbol) ?? 0) - 1;
      if (count > 0) {
        this.counts.set(symbol, count);
        return false;
      }
      this.counts.delete(symbol);
      return true;
    });
  }
}
