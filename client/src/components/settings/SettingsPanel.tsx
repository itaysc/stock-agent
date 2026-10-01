import {
  Accordion,
  Button,
  Divider,
  Paper,
  Select,
  Stack,
  Switch,
  TagsInput,
  Text,
  Title,
} from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import { IconPlayerPlayFilled } from '@tabler/icons-react';
import type { BacktestOptions } from '../../api/types';
import type { FormValues } from '../../lib/form';
import { runButton } from '../../lib/runButton';
import { AdvancedFields } from './AdvancedFields';
import { ModeSwitch } from './ModeSwitch';
import { PeriodField } from './PeriodField';
import { PortfolioFields } from './PortfolioFields';
import { ResearchFields } from './ResearchFields';
import { StrategyFields } from './StrategyFields';
import { WalkForwardFields } from './WalkForwardFields';

interface Props {
  form: UseFormReturnType<FormValues>;
  options: BacktestOptions;
  running: boolean;
  onRun: (values: FormValues) => void;
}

const POPULAR = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'SPY', 'QQQ'];

export function SettingsPanel({ form, options, running, onRun }: Props) {
  const v = form.values;
  const sweep = v.mode === 'sweep';
  const walkForward = v.mode === 'walkforward';
  const research = v.mode === 'research';
  const portfolio = v.mode === 'portfolio';
  const { label, blocked } = runButton(v, options);

  return (
    <Paper p="lg" pos={{ md: 'sticky' }} top={76}>
      <form onSubmit={form.onSubmit(onRun)}>
        <Stack gap="md">
          <Title order={4}>Run settings</Title>
          <ModeSwitch form={form} options={options} />
          {portfolio ? (
            <PortfolioFields form={form} options={options} />
          ) : (
            <>
              <TagsInput
                label="Symbols"
                description="Type a ticker and press Enter"
                placeholder={v.symbols.length ? '' : 'e.g. AAPL'}
                data={POPULAR}
                splitChars={[',', ' ']}
                maxTags={20}
                clearable
                value={v.symbols}
                onChange={(list) =>
                  form.setFieldValue('symbols', [
                    ...new Set(list.map((s) => s.trim().toUpperCase())),
                  ])
                }
              />
              <StrategyFields form={form} options={options} />
            </>
          )}
          <PeriodField form={form} dataStart={options.dataStart} />
          {walkForward && <WalkForwardFields form={form} />}
          {research && <ResearchFields form={form} options={options} />}
          <Select
            label="Timeframe"
            description="Bar size: one decision per bar"
            data={options.timeframes}
            allowDeselect={false}
            {...form.getInputProps('timeframe')}
          />
          <Accordion variant="contained" chevronPosition="right">
            <Accordion.Item value="advanced">
              <Accordion.Control>
                <Text size="sm" fw={500}>
                  Advanced: cash, costs
                  {sweep ? ', ranking' : walkForward ? ', picking' : ''}
                </Text>
              </Accordion.Control>
              <Accordion.Panel>
                <AdvancedFields form={form} options={options} />
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
          <Divider />
          {research ? (
            !options.aiEnabled && (
              <Text size="xs" c="red">
                The AI agent needs OPENAI_API_KEY in server/.env.
              </Text>
            )
          ) : (
            <Switch
              label="AI summary"
              description={
                options.aiEnabled
                  ? 'Short review, recommendation and suggested next tests'
                  : 'Needs OPENAI_API_KEY'
              }
              disabled={!options.aiEnabled}
              {...form.getInputProps('ai', { type: 'checkbox' })}
            />
          )}
          {v.mode === 'backtest' && (
            <Switch
              label="Fresh run"
              description="Re-run even if this exact test is in the run history"
              {...form.getInputProps('fresh', { type: 'checkbox' })}
            />
          )}
          <Button
            type="submit"
            size="md"
            fullWidth
            loading={running}
            disabled={blocked}
            leftSection={<IconPlayerPlayFilled size={16} />}
          >
            {label}
          </Button>
        </Stack>
      </form>
    </Paper>
  );
}
