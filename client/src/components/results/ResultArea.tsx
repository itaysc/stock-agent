import { Alert, Center, Loader, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconAlertTriangle, IconChartAreaLine } from '@tabler/icons-react';
import type { Basket, PlanContext, RobustnessResult, TestPlan } from '../../api/research-types';
import type { Mode } from '../../lib/form';
import type { RunState } from '../Workspace';
import { AiSummaryCard } from './AiSummaryCard';
import {
  fromBacktest,
  fromPortfolio,
  fromSweep,
  fromWalkForward,
} from '../../lib/bottomLineInputs';
import { BacktestSummary } from './BacktestSummary';
import { BottomLineCard } from './BottomLineCard';
import { PaperTradeButton } from '../paper/PaperTradeButton';
import { PortfolioSummary } from './PortfolioSummary';
import { ReportFrame } from './ReportFrame';
import { ResearchView } from './ResearchView';
import { RobustnessPanel } from './RobustnessPanel';
import { SweepSummary } from './SweepSummary';
import { WalkForwardSummary } from './WalkForwardSummary';

const LABELS: Record<Mode, string> = {
  backtest: 'backtest',
  sweep: 'sweep',
  walkforward: 'walk-forward',
  research: 'AI research',
  portfolio: 'portfolio',
};

const RUNNING: Record<Mode, string> = {
  backtest: 'simulating',
  sweep: 'simulating every combination',
  walkforward:
    'picking the best setting in every training window, then trading it on the unseen period',
  research: 'starting the research agent',
  portfolio: 'running every sleeve together',
};

interface Props {
  state: RunState;
  onRunPlan: (plan: TestPlan, ctx: PlanContext) => void;
  baskets: Basket[];
  /** Runs the shown walk-forward setup on each of `symbols`. */
  onCheckRobustness: (symbols: string[]) => Promise<RobustnessResult>;
  /** Deploys the shown result to the paper account (undefined: can't be deployed). */
  onPaperTrade?: () => void;
}

export function ResultArea({ state, onRunPlan, baskets, onCheckRobustness, onPaperTrade }: Props) {
  switch (state.status) {
    case 'idle':
      return (
        <Paper p="xl">
          <Center mih={280}>
            <Stack align="center" gap="xs" maw={420} ta="center">
              <ThemeIcon size={56} radius="xl" variant="light">
                <IconChartAreaLine size={30} />
              </ThemeIcon>
              <Text fw={600} fz="lg">
                Pick a mode and run it
              </Text>
              <Text c="dimmed" size="sm">
                Backtest, sweep, walk-forward, portfolio or the AI agent: set it up on the left.
                Results, the AI review and the full interactive report appear here. Past reports are
                listed below.
              </Text>
            </Stack>
          </Center>
        </Paper>
      );
    case 'running':
      return (
        <Paper p="xl">
          <Center mih={280}>
            <Stack align="center" gap="sm">
              <Loader size="lg" type="bars" />
              <Text fw={600}>Running {LABELS[state.mode]}…</Text>
              <Text size="sm" c="dimmed" ta="center" maw={380}>
                Fetching bars from Alpaca, {RUNNING[state.mode]}, writing the AI summary and the
                report. This usually takes a few seconds.
              </Text>
            </Stack>
          </Center>
        </Paper>
      );
    case 'error':
      return (
        <Alert color="red" icon={<IconAlertTriangle />} title="The run failed">
          <Text size="sm" style={{ whiteSpace: 'pre-line' }}>
            {state.message}
          </Text>
        </Alert>
      );
    case 'research':
      return <ResearchView session={state.session} onPaperTrade={onPaperTrade} />;
    case 'viewing':
      return <ReportFrame url={state.report.url} title={state.report.name} />;
    case 'done': {
      const { result } = state;
      const simple =
        result.kind === 'backtest'
          ? fromBacktest(result)
          : result.kind === 'sweep'
            ? fromSweep(result)
            : result.kind === 'portfolio'
              ? fromPortfolio(result)
              : fromWalkForward(result);
      return (
        <Stack gap="lg">
          {simple && <BottomLineCard input={simple} />}
          {onPaperTrade && <PaperTradeButton onClick={onPaperTrade} />}
          {result.kind === 'backtest' && <BacktestSummary result={result} />}
          {result.kind === 'sweep' && <SweepSummary result={result} />}
          {result.kind === 'walkforward' && <WalkForwardSummary result={result} />}
          {result.kind === 'portfolio' && <PortfolioSummary result={result} />}
          {result.kind === 'walkforward' && (
            <RobustnessPanel
              key={result.reportUrl ?? result.oosFrom}
              baskets={baskets}
              cash={result.initialCash}
              onCheck={onCheckRobustness}
            />
          )}
          <AiSummaryCard
            summary={result.aiSummary}
            skipped={result.aiSkipped}
            saved={result.kind === 'backtest' && result.aiSaved}
            onRunPlan={onRunPlan}
          />
          {result.reportUrl && <ReportFrame url={result.reportUrl} title="Full report" />}
        </Stack>
      );
    }
  }
}
