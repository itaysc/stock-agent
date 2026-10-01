import {
  Button,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  TagsInput,
  Text,
} from '@mantine/core';
import { useState } from 'react';
import type { AutopilotSettings } from '../../api/paper-types';
import type { Basket } from '../../api/research-types';
import { ParamLabel } from '../settings/ParamLabel';

interface Props {
  settings: AutopilotSettings;
  baskets: Basket[];
  onSave: (changes: Partial<AutopilotSettings>) => Promise<void>;
}

const GOALS = [
  { value: 'risk-adjusted', label: 'Best risk / reward' },
  { value: 'beat-hold', label: 'Beat buy & hold' },
  { value: 'return', label: 'Highest return' },
];

/** What the autopilot researches, how often, and how much it may deploy. */
export function AutopilotSettingsForm({ settings, baskets, onSave }: Props) {
  const [v, setV] = useState(settings);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof AutopilotSettings>(key: K, value: AutopilotSettings[K]) =>
    setV((s) => ({ ...s, [key]: value }));
  const num =
    (
      key:
        | 'everyDays'
        | 'symbolsPerRun'
        | 'rounds'
        | 'capitalPerDeployment'
        | 'maxDeployments'
        | 'retireBehindAfterDays',
    ) =>
    (value: string | number) =>
      set(key, Number(value) || 0);
  const save = async () => {
    setSaving(true);
    const { enabled: _e, nextIndex: _n, nextGroup: _g, lastRunAt: _l, ...changes } = v;
    await onSave(changes).finally(() => setSaving(false));
  };
  const calls = (v.symbolsPerRun + (v.groups.length ? 1 : 0)) * (v.rounds + 1);
  return (
    <Stack gap="sm">
      <TagsInput
        label="Watchlist"
        description="It researches these one at a time, taking turns"
        splitChars={[',', ' ']}
        value={v.watchlist}
        onChange={(list) => set('watchlist', [...new Set(list.map((s) => s.trim().toUpperCase()))])}
      />
      <MultiSelect
        label="Groups"
        description="Also research one group as a whole each run, taking turns: lets it find rotation strategies (hold the best of the group)"
        data={baskets.map((b) => ({ value: b.id, label: `${b.name} (${b.symbols.length})` }))}
        value={v.groups}
        onChange={(groups) => set('groups', groups)}
      />
      <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
        <NumberInput
          label="Run every"
          suffix=" days"
          min={1}
          max={90}
          value={v.everyDays}
          onChange={num('everyDays')}
        />
        <NumberInput
          label="Symbols per run"
          min={1}
          max={10}
          value={v.symbolsPerRun}
          onChange={num('symbolsPerRun')}
        />
        <NumberInput
          label="AI rounds per symbol"
          min={1}
          max={10}
          value={v.rounds}
          onChange={num('rounds')}
        />
        <NumberInput
          label="Money per deployment"
          prefix="$"
          thousandSeparator=","
          min={100}
          step={1_000}
          value={v.capitalPerDeployment}
          onChange={num('capitalPerDeployment')}
        />
        <NumberInput
          label="Max deployments"
          min={0}
          max={20}
          value={v.maxDeployments}
          onChange={num('maxDeployments')}
        />
        <NumberInput
          label={
            <ParamLabel
              name="Retire if behind after"
              description="A deployment still behind its backtest after this many trading days is retired (stopped and sold). A tripped guard or a drop deeper than the backtest's worst retires it right away."
            />
          }
          suffix=" days"
          min={5}
          max={500}
          value={v.retireBehindAfterDays}
          onChange={num('retireBehindAfterDays')}
        />
        <Select
          label="Goal"
          data={GOALS}
          allowDeselect={false}
          value={v.goal}
          onChange={(g) => g && set('goal', g as AutopilotSettings['goal'])}
        />
        <Select
          label="Check on other symbols"
          data={baskets.map((b) => ({ value: b.id, label: b.name }))}
          allowDeselect={false}
          value={v.basket}
          onChange={(b) => b && set('basket', b)}
        />
      </SimpleGrid>
      <Group justify="space-between">
        <Text size="xs" c="dimmed">
          About {calls} AI calls per run (a few cents). Only ideas that pass the hidden-year and
          multi-symbol checks are deployed.
        </Text>
        <Button size="xs" onClick={save} loading={saving} disabled={v.watchlist.length === 0}>
          Save settings
        </Button>
      </Group>
    </Stack>
  );
}
