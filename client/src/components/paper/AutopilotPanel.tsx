import {
  Accordion,
  Alert,
  Badge,
  Button,
  Group,
  List,
  Paper,
  Stack,
  Switch,
  Text,
} from '@mantine/core';
import { IconPlayerPlay, IconRobot } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { AutopilotRun, AutopilotState } from '../../api/paper-types';
import type { Basket } from '../../api/research-types';
import { AutopilotSettingsForm } from './AutopilotSettingsForm';

const KIND_COLOR: Record<AutopilotRun['decisions'][number]['kind'], string> = {
  deployed: 'teal',
  retired: 'orange',
  researched: 'blue',
  kept: 'gray',
  skipped: 'gray',
  error: 'red',
};
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : 'n/a');

/** Turn the autopilot on/off, run it, change its settings, and see what it decided. */
export function AutopilotPanel({
  baskets,
  onChanged,
}: {
  baskets: Basket[];
  onChanged: () => void;
}) {
  const [state, setState] = useState<AutopilotState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(
    () => api.autopilot().then(setState, (err: Error) => setError(err.message)),
    [],
  );
  useEffect(() => void load(), [load]);
  useEffect(() => {
    if (!state?.running) return;
    const timer = setInterval(() => void load().then(onChanged), 5_000);
    return () => clearInterval(timer);
  }, [state?.running, load, onChanged]);

  if (error) return <Alert color="red">{error}</Alert>;
  if (!state) return null;
  const s = state.settings;
  const update = async (changes: object) => setState(await api.updateAutopilot(changes));
  const runNow = async () => {
    try {
      await api.runAutopilot();
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const status = state.running
    ? 'Running now: researching and deciding…'
    : !s.enabled
      ? 'Off. It will not do anything until you turn it on.'
      : state.nextRunAt && new Date(state.nextRunAt) > new Date()
        ? `On. Next run ${when(state.nextRunAt)}; in between it checks its deployments every hour.`
        : 'On. It runs within the hour.';
  return (
    <Paper p="md" withBorder>
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Group gap="xs" align="flex-start" wrap="nowrap">
            <IconRobot size={22} />
            <div>
              <Text fw={700}>Autopilot</Text>
              <Text size="xs" c="dimmed" maw={520}>
                On a schedule it retires its paper deployments that fail, researches the next
                symbols of your watchlist with the AI agent, and paper-deploys the ideas that pass
                every check. Your own deployments are never touched.
              </Text>
            </div>
          </Group>
          <Group gap="xs">
            <Button
              size="xs"
              variant="default"
              leftSection={<IconPlayerPlay size={14} />}
              onClick={runNow}
              disabled={!!state.running}
            >
              Run now
            </Button>
            <Switch
              label={s.enabled ? 'On' : 'Off'}
              checked={s.enabled}
              onChange={(e) => void update({ enabled: e.currentTarget.checked })}
            />
          </Group>
        </Group>
        <Text size="sm">{status}</Text>
        {!state.schedulerOn && (
          <Text size="xs" c="orange">
            The schedule is off on the server (AUTOPILOT_SCHEDULER_ENABLED=false): only Run now
            works.
          </Text>
        )}
        <Accordion variant="contained">
          <Accordion.Item value="settings">
            <Accordion.Control>
              <Text size="sm">
                Settings: {s.watchlist.length} symbols, every {s.everyDays} days, $
                {s.capitalPerDeployment.toLocaleString('en-US')} each, max {s.maxDeployments}
              </Text>
            </Accordion.Control>
            <Accordion.Panel>
              <AutopilotSettingsForm
                key={JSON.stringify(s)}
                settings={s}
                baskets={baskets}
                onSave={update}
              />
            </Accordion.Panel>
          </Accordion.Item>
          {[state.running, ...state.runs]
            .filter((r): r is AutopilotRun => !!r)
            .filter((r, i, all) => all.findIndex((x) => x.id === r.id) === i)
            .slice(0, 8)
            .map((r) => (
              <Accordion.Item key={r.id} value={r.id}>
                <Accordion.Control>
                  <Group gap="xs">
                    <Badge
                      size="xs"
                      variant="light"
                      color={
                        r.status === 'failed' ? 'red' : r.status === 'running' ? 'blue' : 'gray'
                      }
                    >
                      {r.status}
                    </Badge>
                    <Text size="sm">
                      {when(r.startedAt)} · {r.trigger === 'review' ? 'hourly check' : r.trigger} ·{' '}
                      {r.decisions.filter((d) => d.kind === 'deployed').length} deployed,{' '}
                      {r.decisions.filter((d) => d.kind === 'retired').length} retired
                    </Text>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  {r.error && (
                    <Text size="sm" c="red">
                      {r.error}
                    </Text>
                  )}
                  <List size="sm" spacing={4}>
                    {r.decisions.map((d, i) => (
                      <List.Item
                        key={i}
                        icon={
                          <Badge size="xs" variant="light" color={KIND_COLOR[d.kind]}>
                            {d.kind}
                          </Badge>
                        }
                      >
                        {d.message}
                      </List.Item>
                    ))}
                  </List>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
        </Accordion>
      </Stack>
    </Paper>
  );
}
