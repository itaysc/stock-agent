import {
  Alert,
  Button,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { IconAlertTriangle, IconRocket } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { DeploymentView, DeployTarget } from '../../api/paper-types';

interface Props {
  target: DeployTarget | null;
  onClose: () => void;
  onDeployed: (d: DeploymentView) => void;
}

/** "Paper trade this": name, paper money and guard, then deploy. */
export function DeployModal({ target, onClose, onDeployed }: Props) {
  const [name, setName] = useState('');
  const [capital, setCapital] = useState<number>(10_000);
  const [guard, setGuard] = useState<number | ''>('');
  const [newsTone, setNewsTone] = useState<number>(0.3);
  const [newsAi, setNewsAi] = useState(true);
  const [watch, setWatch] = useState<'off' | 'alert' | 'sell'>('alert');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setName(target?.name ?? '');
    setError(null);
  }, [target]);

  const deploy = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    const common = {
      name,
      capital,
      ...(guard === '' ? {} : { maxDrawdownPct: guard }),
      newsCheck: { tone: newsTone, ai: newsAi, watch },
    };
    try {
      const d =
        target.kind === 'sleeves'
          ? await api.deploy({ ...common, sleeves: target.sleeves })
          : await api.deployResearch({
              ...common,
              researchId: target.researchId,
              allowNonCandidate: !target.candidate,
            });
      onDeployed(d);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={target !== null} onClose={onClose} title="Paper trade this" centered>
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Runs on your Alpaca <b>paper</b> account (fake money). After each trading day closes it
          checks the signals, and its orders fill at the next open, like the backtest. You can pause
          or stop it any time.
        </Text>
        {target?.kind === 'research' && !target.candidate && (
          <Alert color="orange" variant="light" icon={<IconAlertTriangle />}>
            This idea did not pass every check (holdout and other symbols). It&apos;s fine to watch
            it on paper, but don&apos;t expect it to hold up.
          </Alert>
        )}
        <TextInput
          label="Name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          maxLength={80}
        />
        <NumberInput
          label="Paper money for it"
          prefix="$"
          thousandSeparator=","
          min={100}
          step={1_000}
          value={capital}
          onChange={(v) => setCapital(Number(v) || 0)}
        />
        <NumberInput
          label="Safety guard"
          description="Pause and sell everything when it's this % below its peak. Empty = 1.5× the backtest's worst drop (at least 10%)."
          suffix="%"
          min={1}
          max={90}
          placeholder="auto"
          value={guard}
          onChange={(v) => setGuard(v === '' ? '' : Number(v))}
        />
        <Text size="sm" fw={600}>
          Real-time news check
        </Text>
        <NumberInput
          label="Skip a buy on negative news"
          description="Its buys wait for a check before the open: skipped when the headlines since the signal average this negative or worse (tone −1 to +1). 0 = no tone check."
          min={0}
          max={1}
          step={0.05}
          decimalScale={2}
          value={newsTone}
          onChange={(v) => setNewsTone(Number(v) || 0)}
        />
        <Switch
          label="Let the AI read the headlines too"
          description="Catches serious events a word list misses (fraud, halts, the CEO quitting). Needs OPENAI_API_KEY; a few cents a month."
          checked={newsAi}
          onChange={(e) => setNewsAi(e.currentTarget.checked)}
        />
        <Select
          label="Breaking news about what it holds"
          data={[
            { value: 'alert', label: 'Alert me (log + notification)' },
            { value: 'sell', label: 'Sell it (and alert me)' },
            { value: 'off', label: 'Ignore' },
          ]}
          allowDeselect={false}
          value={watch}
          onChange={(v) => v && setWatch(v as typeof watch)}
        />
        {error && (
          <Alert color="red" variant="light" icon={<IconAlertTriangle />}>
            {error}
          </Alert>
        )}
        <Button
          leftSection={<IconRocket size={16} />}
          loading={busy}
          onClick={deploy}
          disabled={!(capital >= 100)}
        >
          Start paper trading
        </Button>
      </Stack>
    </Modal>
  );
}
