import { AppShell, Container, Grid, SegmentedControl, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useCallback, useState } from 'react';
import { api } from '../api/client';
import type { DeployTarget } from '../api/paper-types';
import type { PlanContext, ResearchSession, TestPlan } from '../api/research-types';
import type { BacktestOptions, ReportItem, RunResponse } from '../api/types';
import { useReports } from '../hooks/useApi';
import { useResearchPolling } from '../hooks/useResearchPolling';
import {
  backtestBody,
  defaultValues,
  type FormValues,
  portfolioBody,
  researchBody,
  robustnessBody,
  sweepBody,
  walkForwardBody,
} from '../lib/form';
import { deployTargetFor } from '../lib/deployTarget';
import { formFromPlan } from '../lib/plan';
import { Header, type Page } from './Header';
import { DeployModal } from './paper/DeployModal';
import { PaperPage } from './paper/PaperPage';
import { BrokerPage } from './broker/BrokerPage';
import { RecentReports } from './RecentReports';
import { ResultArea } from './results/ResultArea';
import { SettingsPanel } from './settings/SettingsPanel';

export type RunState =
  | { status: 'idle' }
  | { status: 'running'; mode: FormValues['mode'] }
  | { status: 'error'; message: string }
  | { status: 'done'; result: RunResponse }
  | { status: 'research'; session: ResearchSession }
  | { status: 'viewing'; report: ReportItem };

export function Workspace({ options }: { options: BacktestOptions }) {
  const form = useForm<FormValues>({ initialValues: defaultValues(options) });
  const [state, setState] = useState<RunState>({ status: 'idle' });
  // The settings of the result on screen (the form may change after the run).
  const [ranWith, setRanWith] = useState<FormValues | null>(null);
  const { reports, refresh } = useReports();

  const run = async (values: FormValues) => {
    setState({ status: 'running', mode: values.mode });
    setRanWith(values);
    try {
      if (values.mode === 'research') {
        setState({ status: 'research', session: await api.startResearch(researchBody(values)) });
        return;
      }
      const result =
        values.mode === 'backtest'
          ? await api.backtest(backtestBody(values))
          : values.mode === 'sweep'
            ? await api.sweep(sweepBody(values))
            : values.mode === 'portfolio'
              ? await api.portfolio(portfolioBody(values))
              : await api.walkForward(walkForwardBody(values));
      setState({ status: 'done', result });
      refresh();
    } catch (err) {
      setState({ status: 'error', message: (err as Error).message });
    }
  };

  const onResearchUpdate = useCallback(
    (session: ResearchSession) => {
      setState((prev) =>
        prev.status === 'research' && prev.session.id === session.id
          ? { status: 'research', session }
          : prev,
      );
      if (session.status !== 'running') refresh();
    },
    [refresh],
  );
  useResearchPolling(state.status === 'research' ? state.session : null, onResearchUpdate);

  /** Loads an AI-suggested test into the settings and runs it. */
  const runPlan = (plan: TestPlan, ctx: PlanContext) => {
    const next = formFromPlan(form.values, plan, ctx, options);
    form.setValues(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    void run(next);
  };
  const [page, setPage] = useState<Page>('broker');
  const [deploying, setDeploying] = useState<DeployTarget | null>(null);
  const [deployedId, setDeployedId] = useState<string | null>(null);
  const deployTarget: DeployTarget | null =
    state.status === 'done'
      ? deployTargetFor(state.result, ranWith)
      : state.status === 'research' && state.session.status === 'done' && state.session.holdout
        ? {
            kind: 'research',
            researchId: state.session.id,
            name: `AI: ${state.session.request.symbols.join(', ')}`,
            candidate: state.session.candidate,
          }
        : null;

  const busy =
    state.status === 'running' ||
    (state.status === 'research' && state.session.status === 'running');

  const activeUrl =
    state.status === 'done'
      ? state.result.reportUrl
      : state.status === 'research'
        ? state.session.reportUrl
        : state.status === 'viewing'
          ? state.report.url
          : null;

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Header options={options} page={page} onPage={setPage} />
      </AppShell.Header>
      <AppShell.Main>
        <Container size="xl" px={{ base: 0, sm: 'md' }}>
          {page !== 'broker' && (
            <SegmentedControl
              mb="md"
              size="xs"
              value={page}
              onChange={(v) => setPage(v as Page)}
              data={[
                { value: 'lab', label: 'Lab: backtests & AI research' },
                { value: 'paper', label: 'Paper trading & autopilot' },
              ]}
            />
          )}
          {page === 'broker' ? (
            <BrokerPage />
          ) : page === 'paper' ? (
            <PaperPage selectId={deployedId} baskets={options.baskets} />
          ) : (
            <Grid gap="lg" align="flex-start">
              <Grid.Col span={{ base: 12, md: 4 }}>
                <SettingsPanel form={form} options={options} running={busy} onRun={run} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 8 }}>
                <Stack gap="lg">
                  <ResultArea
                    state={state}
                    onRunPlan={runPlan}
                    baskets={options.baskets}
                    onPaperTrade={deployTarget ? () => setDeploying(deployTarget) : undefined}
                    onCheckRobustness={(symbols) =>
                      api.robustness(robustnessBody(ranWith ?? form.values, symbols))
                    }
                  />
                  <RecentReports
                    reports={reports}
                    activeUrl={activeUrl}
                    onOpen={(report) => setState({ status: 'viewing', report })}
                  />
                </Stack>
              </Grid.Col>
            </Grid>
          )}
        </Container>
        <DeployModal
          target={deploying}
          onClose={() => setDeploying(null)}
          onDeployed={(d) => {
            setDeploying(null);
            setDeployedId(d.id);
            setPage('paper');
          }}
        />
      </AppShell.Main>
    </AppShell>
  );
}
