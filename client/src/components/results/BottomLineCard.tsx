import { Badge, Group, Paper, RingProgress, SimpleGrid, Stack, Text, Tooltip } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { type BottomLineInput, bottomLine, type Trust } from '../../lib/bottomLine';
import { money } from '../../lib/format';

const TRUST: Record<Trust, { color: string; label: string }> = {
  low: { color: 'red', label: 'Low' },
  medium: { color: 'yellow', label: 'Medium' },
  high: { color: 'teal', label: 'High' },
};
const SCORE_HELP =
  'Out of 100: up to 40 points for how much it made per year, up to 40 for doing better than simply buying and holding, and up to 20 for small drops along the way. 75+ is good, under 40 is poor.';

const signed = (n: number) => `${n >= 0 ? '+' : '−'}${money(Math.abs(n))}`;
const percent = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)}%`;

function Fact({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color?: string;
}) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fz={20} fw={700} c={color} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Text>
      <Text size="xs" c="dimmed">
        {sub}
      </Text>
    </div>
  );
}

/** Plain-words summary for non-experts: a score, the money, and how much to trust it. */
export function BottomLineCard({ input }: { input: BottomLineInput }) {
  const b = bottomLine(input);
  const years =
    b.years >= 1
      ? `${b.years.toFixed(1)} years`
      : `${Math.max(1, Math.round(b.years * 12))} months`;
  const holding = input.symbols.length === 1 ? input.symbols[0] : input.symbols.join(' and ');
  return (
    <Paper p="lg" withBorder style={{ borderColor: `var(--mantine-color-${b.color}-filled)` }}>
      <Group align="flex-start" gap="lg">
        <Tooltip label={SCORE_HELP} multiline w={300} withArrow>
          <RingProgress
            size={116}
            thickness={10}
            roundCaps
            sections={[{ value: b.score, color: b.color }]}
            label={
              <Stack gap={0} align="center">
                <Text fz={30} fw={800} lh={1}>
                  {b.score}
                </Text>
                <Text size="xs" fw={700} c={b.color}>
                  {b.grade}
                </Text>
              </Stack>
            }
          />
        </Tooltip>
        <Stack gap="sm" style={{ flex: 1, minWidth: 240 }}>
          <div>
            <Group gap={6}>
              <Text size="sm" c="dimmed">
                Bottom line: {input.name} on {input.symbols.join(', ')}
              </Text>
              <Tooltip label={b.trustWhy} multiline w={300} withArrow>
                <Badge
                  variant="light"
                  color={TRUST[b.trust].color}
                  rightSection={<IconInfoCircle size={12} />}
                >
                  Trust: {TRUST[b.trust].label}
                </Badge>
              </Tooltip>
            </Group>
            <Text fz="xl" fw={700}>
              {b.verdict}
            </Text>
            <Text size="sm" c="dimmed">
              Starting with {money(input.startCash)} on {dayjs(input.from).format('MMM D, YYYY')},
              over {years} (until {dayjs(input.to).format('MMM D, YYYY')}):
            </Text>
          </div>
          <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="md">
            <Fact
              label="You'd end with"
              value={money(input.endCash)}
              sub={`${signed(b.gain)} (${percent(b.gainPct)})${input.interestEarned ? `, incl. ${money(input.interestEarned)} interest on idle cash` : ''}`}
              color={b.gain >= 0 ? 'teal' : 'red'}
            />
            <Fact
              label={`Just holding ${holding}`}
              value={b.holdEnd === null ? 'n/a' : money(b.holdEnd)}
              sub={
                b.vsHold === null
                  ? ''
                  : `the strategy made ${money(Math.abs(b.vsHold))} ${b.vsHold >= 0 ? 'more' : 'less'}`
              }
            />
            <Fact
              label="Worst drop along the way"
              value={`−${input.worstDropPct.toFixed(1)}%`}
              sub={
                input.holdWorstDropPct === null
                  ? ''
                  : `holding: −${input.holdWorstDropPct.toFixed(1)}%`
              }
              color={input.worstDropPct > 20 ? 'red' : undefined}
            />
          </SimpleGrid>
          <Text size="xs" c="dimmed">
            {input.trades} trades
            {input.winRatePct !== null && input.trades > 0
              ? `, ${Math.round((input.winRatePct / 100) * input.trades)} of them made money`
              : ''}
            . {b.trustWhy}
          </Text>
        </Stack>
      </Group>
    </Paper>
  );
}
