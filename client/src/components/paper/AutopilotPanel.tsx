import { Accordion, Alert, Button, Group, Paper, Stack, Switch, Text } from '@mantine/core';
import { IconPlayerPlay, IconRobot } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { AutopilotRun, AutopilotState } from '../../api/paper-types';
import type { Basket } from '../../api/research-types';
import { AutopilotSettingsForm } from './AutopilotSettingsForm';
import { AgentNow } from './AgentNow';
import { AutopilotRuns } from './AutopilotRuns';
import { IdeasList } from './IdeasList';
import { ResearchDrawer } from './ResearchDrawer';

const TELEGRAM: Record<AutopilotState['telegram'], string> = {
  commands: 'Telegram: ideas come with Invest / Skip buttons; send /help to your bot for commands.',
  'send-only': 'Telegram: messages only (TELEGRAM_COMMANDS_ENABLED=false), so answer ideas here.',
  off: 'Telegram: set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID in server/.env to get ideas there and answer with a tap.',
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
  const [reasoning, setReasoning] = useState<string | null>(null);
  const load = useCallback(
    () => api.autopilot().then(setState, (err: Error) => setError(err.message)),
    [],
  );
  useEffect(() => void load(), [load]);
  // Every 5 s while it runs; every 30 s otherwise (a run can start from Telegram).
  const running = !!state?.running;
  useEffect(() => {
    const timer = setInterval(
      () => void load().then(() => running && onChanged()),
      running ? 5_000 : 30_000,
    );
    return () => clearInterval(timer);
  }, [running, load, onChanged]);

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
                symbols of your watchlist with the AI agent, and sends you the ideas that pass every
                check (here and in Telegram) to paper-invest with one tap. Your own deployments are
                never touched.
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
              label="Ask me first"
              checked={s.askFirst}
              onChange={(e) => void update({ askFirst: e.currentTarget.checked })}
            />
            <Switch
              label={s.enabled ? 'On' : 'Off'}
              checked={s.enabled}
              onChange={(e) => void update({ enabled: e.currentTarget.checked })}
            />
          </Group>
        </Group>
        <Text size="sm">{status}</Text>
        {state.running && <AgentNow run={state.running} onReasoning={setReasoning} />}
        <Text size="xs" c="dimmed">
          {TELEGRAM[state.telegram]}
        </Text>
        <IdeasList
          ideas={state.ideas}
          onAnswered={() => void load().then(onChanged)}
          onReasoning={setReasoning}
        />
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
          <AutopilotRuns
            runs={[state.running, ...state.runs].filter((r): r is AutopilotRun => !!r)}
            onReasoning={setReasoning}
          />
        </Accordion>
      </Stack>
      <ResearchDrawer id={reasoning} onClose={() => setReasoning(null)} />
    </Paper>
  );
}
