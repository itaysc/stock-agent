import { Alert, Badge, Group, Stack, Text, Title } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import type { ResearchSession } from '../../api/research-types';
import { fromResearch } from '../../lib/bottomLineInputs';
import { day } from '../../lib/format';
import { planParams } from '../../lib/plan';
import { AiSummaryCard } from './AiSummaryCard';
import { ReportFrame } from './ReportFrame';
import { PaperTradeButton } from '../paper/PaperTradeButton';
import { ResearchTimeline } from './ResearchTimeline';
import { RobustnessCard } from './RobustnessCard';
import { BottomLineCard } from './BottomLineCard';

const STATUS = {
  running: { color: 'blue', label: 'Running' },
  done: { color: 'teal', label: 'Done' },
  failed: { color: 'red', label: 'Failed' },
} as const;

/** A research session, live while it runs: holdout result and verdict first once done. */
export function ResearchView({
  session,
  onPaperTrade,
}: {
  session: ResearchSession;
  onPaperTrade?: () => void;
}) {
  const r = session.request;
  const champion = session.experiments.find((e) => e.id === session.championId);
  const h = session.holdout;
  const simple = fromResearch(session);
  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={3}>AI research: {r.symbols.join(', ')}</Title>
          <Text size="sm" c="dimmed">
            research {day(r.from)} → {day(session.researchTo)} · holdout {day(session.researchTo)} →{' '}
            {day(r.to)} · {session.experiments.length} tests in {session.rounds.length}/{r.rounds}{' '}
            rounds
            {session.stoppedBecause ? ` · stopped: ${session.stoppedBecause}` : ''}
          </Text>
        </div>
        <Badge variant="light" color={STATUS[session.status].color}>
          {STATUS[session.status].label}
        </Badge>
      </Group>
      {session.error && (
        <Alert color="red" icon={<IconAlertTriangle />} title="The research failed">
          {session.error}
        </Alert>
      )}
      {simple && <BottomLineCard input={simple} />}
      {h && champion && (
        <Text size="sm" c="dimmed">
          Best idea found (#{champion.id}): <b>{champion.plan.strategies.join(' + ')}</b>{' '}
          {planParams(champion.plan)}. The numbers above are its only run on the last {r.holdout},
          which the agent never saw. It currently picks:{' '}
          {h.outcome.latestPick
            ? Object.entries(h.outcome.latestPick.params)
                .map(([k, v]) => `${k}=${v}`)
                .join(' ') || 'defaults'
            : 'none'}
          .
        </Text>
      )}
      {session.robustness && <RobustnessCard result={session.robustness} cash={r.initialCash} />}
      {session.status === 'done' && (
        <Alert
          color={session.candidate ? 'teal' : 'gray'}
          variant="light"
          title={session.candidate ? 'Paper-trading candidate' : 'Not a paper-trading candidate'}
        >
          {session.candidate
            ? 'It beat holding on the hidden final period and on most symbols of the basket.'
            : 'It needs to beat holding on the hidden final period and on most symbols of the basket.'}
        </Alert>
      )}
      {session.status === 'done' && session.holdout && onPaperTrade && (
        <PaperTradeButton
          onClick={onPaperTrade}
          note={
            session.candidate
              ? 'Passed every check: try its latest pick with fake money.'
              : 'Did not pass every check: you can still watch it on paper.'
          }
        />
      )}
      {session.verdict && (
        <AiSummaryCard summary={session.verdict} skipped={null} title="AI verdict" />
      )}
      <ResearchTimeline session={session} />
      {session.reportUrl && <ReportFrame url={session.reportUrl} title="Full report" />}
    </Stack>
  );
}
