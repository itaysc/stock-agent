import { Alert, Button, Group, Paper, Select, Stack, Text } from '@mantine/core';
import { IconAlertTriangle, IconWorldSearch } from '@tabler/icons-react';
import { useState } from 'react';
import type { Basket, RobustnessResult } from '../../api/research-types';
import { RobustnessCard } from './RobustnessCard';

interface Props {
  baskets: Basket[];
  cash: number;
  /** Runs the shown setup on each symbol of the basket. */
  onCheck: (symbols: string[]) => Promise<RobustnessResult>;
}

/** "Does it work on other symbols too?" for a walk-forward result. */
export function RobustnessPanel({ baskets, cash, onCheck }: Props) {
  const [basket, setBasket] = useState(baskets[0]?.id ?? '');
  const [state, setState] = useState<
    | { status: 'idle' }
    | { status: 'running' }
    | { status: 'done'; result: RobustnessResult }
    | { status: 'error'; message: string }
  >({ status: 'idle' });
  const check = async () => {
    const chosen = baskets.find((b) => b.id === basket);
    if (!chosen) return;
    setState({ status: 'running' });
    try {
      setState({ status: 'done', result: await onCheck(chosen.symbols) });
    } catch (err) {
      setState({ status: 'error', message: (err as Error).message });
    }
  };
  return (
    <Stack gap="sm">
      <Paper p="md">
        <Text fw={600} size="sm">
          Does it work on other symbols too?
        </Text>
        <Text size="xs" c="dimmed" mb="sm">
          Runs this exact setup on each symbol of a basket, on its own. A setup that only works on
          one stock is most likely luck.
        </Text>
        <Group gap="sm" align="flex-end">
          <Select
            size="sm"
            data={baskets.map((b) => ({
              value: b.id,
              label: `${b.name}: ${b.symbols.join(', ')}`,
            }))}
            value={basket}
            onChange={(v) => v && setBasket(v)}
            allowDeselect={false}
            style={{ flex: 1, minWidth: 220 }}
          />
          <Button
            leftSection={<IconWorldSearch size={16} />}
            loading={state.status === 'running'}
            onClick={check}
          >
            Check
          </Button>
        </Group>
      </Paper>
      {state.status === 'error' && (
        <Alert color="red" icon={<IconAlertTriangle />} title="The check failed">
          {state.message}
        </Alert>
      )}
      {state.status === 'done' && <RobustnessCard result={state.result} cash={cash} />}
    </Stack>
  );
}
