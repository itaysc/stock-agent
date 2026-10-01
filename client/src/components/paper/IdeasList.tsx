import { Alert, Button, Group, NumberInput, Paper, Stack, Text } from '@mantine/core';
import { IconBulb } from '@tabler/icons-react';
import { useState } from 'react';
import { api } from '../../api/client';
import type { Idea } from '../../api/paper-types';

/** Open ideas with their evidence: invest (paper) or skip, like the Telegram buttons. */
export function IdeasList({
  ideas,
  onAnswered,
  onReasoning,
}: {
  ideas: Idea[];
  onAnswered: () => void;
  onReasoning: (researchId: string) => void;
}) {
  const [reply, setReply] = useState<string | null>(null);
  if (!ideas.length && !reply) return null;
  return (
    <Stack gap="xs">
      {reply && (
        <Alert variant="light" withCloseButton onClose={() => setReply(null)}>
          {reply}
        </Alert>
      )}
      {ideas.map((idea) => (
        <IdeaCard
          key={idea.id}
          idea={idea}
          onReasoning={() => onReasoning(idea.researchId)}
          onDone={(message) => {
            setReply(message);
            onAnswered();
          }}
        />
      ))}
    </Stack>
  );
}

function IdeaCard({
  idea,
  onDone,
  onReasoning,
}: {
  idea: Idea;
  onDone: (message: string) => void;
  onReasoning: () => void;
}) {
  const [amount, setAmount] = useState<number>(idea.capital);
  const [busy, setBusy] = useState(false);
  const act = async (call: () => Promise<{ message: string }>) => {
    setBusy(true);
    try {
      onDone((await call()).message);
    } catch (err) {
      onDone((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  // The first line is the title; the last lines are the Telegram commands.
  const [title, ...rest] = idea.message.split('\n');
  const body = rest.filter((l) => !/^(\/invest|Invest |How much paper money)/.test(l)).join('\n');
  return (
    <Paper p="sm" withBorder>
      <Group gap={6} mb={4}>
        <IconBulb size={16} />
        <Text fw={600} size="sm">
          {title.replace(/^💡 /, '')}
        </Text>
      </Group>
      <Text size="xs" style={{ whiteSpace: 'pre-wrap' }}>
        {body.trim()}
      </Text>
      <Group gap="xs" mt="xs" align="flex-end">
        <NumberInput
          size="xs"
          w={150}
          label="How much?"
          description={`suggested $${idea.capital.toLocaleString('en-US')}`}
          prefix="$"
          thousandSeparator=","
          min={100}
          step={1_000}
          value={amount}
          onChange={(v) => setAmount(Number(v) || 0)}
        />
        <Button
          size="xs"
          color="teal"
          loading={busy}
          disabled={!(amount > 0)}
          onClick={() => void act(() => api.investIdea(idea.id, amount))}
        >
          Invest (paper)
        </Button>
        <Button
          size="xs"
          variant="default"
          disabled={busy}
          onClick={() => void act(() => api.skipIdea(idea.id))}
        >
          Skip
        </Button>
        <Button size="xs" variant="subtle" onClick={onReasoning}>
          See the reasoning
        </Button>
        <Text size="xs" c="dimmed">
          until {new Date(idea.expiresAt).toLocaleDateString()}
        </Text>
      </Group>
    </Paper>
  );
}
