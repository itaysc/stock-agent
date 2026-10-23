import { Autocomplete, Loader } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { Asset } from '../../api/trade-types';

/** Type a ticker or a company name; picking one calls `onPick` with its ticker. */
export function TickerSearch({ onPick }: { onPick: (symbol: string) => void }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Asset[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const text = q.trim();
    if (!text || text.includes(' — ')) return setFound([]);
    setBusy(true);
    // Wait for a pause in typing before asking the server.
    const t = setTimeout(
      () =>
        void api
          .tradeSearch(text)
          .then(setFound, () => setFound([]))
          .finally(() => setBusy(false)),
      250,
    );
    return () => clearTimeout(t);
  }, [q]);
  return (
    <Autocomplete
      placeholder="Ticker or company, e.g. NVDA or Nvidia"
      leftSection={<IconSearch size={16} />}
      rightSection={busy ? <Loader size="xs" /> : null}
      value={q}
      onChange={setQ}
      data={found.map((a) => ({
        value: `${a.symbol} — ${a.name}`,
        label: `${a.symbol} — ${a.name}`,
      }))}
      filter={({ options }) => options}
      onOptionSubmit={(v) => {
        onPick(v.split(' — ')[0]);
        setQ('');
        setFound([]);
      }}
      onKeyDown={(e) => {
        // Enter on a plain ticker picks it right away.
        if (e.key === 'Enter' && /^[A-Za-z][A-Za-z0-9.]{0,9}$/.test(q.trim())) {
          onPick(q.trim().toUpperCase());
          setQ('');
        }
      }}
      maxDropdownHeight={300}
    />
  );
}
