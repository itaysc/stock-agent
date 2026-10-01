import { Badge, Group, Paper, Table, Text } from '@mantine/core';
import type { RobustnessResult } from '../../api/research-types';
import { bottomLine } from '../../lib/bottomLine';
import { fromOutcome } from '../../lib/bottomLineInputs';
import { day, money } from '../../lib/format';

/** The multi-symbol check in plain words: on how many symbols it beat just holding. */
export function RobustnessCard({ result, cash }: { result: RobustnessResult; cash: number }) {
  const s = result.summary;
  const rows = result.rows
    .map((row) => ({
      row,
      simple: row.outcome ? bottomLine(fromOutcome('', [row.symbol], row.outcome, cash)) : null,
    }))
    .sort((a, b) => (b.row.score ?? -Infinity) - (a.row.score ?? -Infinity));
  return (
    <Paper
      p="lg"
      withBorder
      style={{ borderColor: `var(--mantine-color-${s.passed ? 'teal' : 'red'}-filled)` }}
    >
      <Group justify="space-between" mb={4}>
        <Text size="sm" c="dimmed">
          {result.mode === 'universes'
            ? 'Multi-group check: the same rotation on other groups of symbols'
            : 'Multi-symbol check: the same setup on each symbol, on its own'}{' '}
          ({day(result.from)} → {day(result.to)})
        </Text>
        <Badge variant="light" color={s.passed ? 'teal' : 'red'}>
          {s.passed ? 'Passed' : 'Failed'}
        </Badge>
      </Group>
      <Text fz="lg" fw={700} mb="xs">
        {s.verdict}
      </Text>
      <Text size="xs" c="dimmed" mb="sm">
        It passes when it does better than just holding on at least 6 in 10 symbols. Something that
        works on one stock only is most likely luck.
      </Text>
      <Table.ScrollContainer minWidth={480}>
        <Table verticalSpacing={4} fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{result.mode === 'universes' ? 'Group' : 'Symbol'}</Table.Th>
              <Table.Th>Grade</Table.Th>
              <Table.Th ta="right">{money(cash)} became</Table.Th>
              <Table.Th ta="right">Just holding</Table.Th>
              <Table.Th ta="right">Worst drop</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map(({ row, simple }) => (
              <Table.Tr key={row.symbol}>
                <Table.Td fw={600}>
                  {row.symbol} {(row.score ?? 0) > 0 && '✓'}
                </Table.Td>
                {simple && row.outcome ? (
                  <>
                    <Table.Td>
                      <Badge variant="light" color={simple.color}>
                        {simple.score} {simple.grade}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="right" c={simple.gain >= 0 ? 'teal' : 'red'}>
                      {money(cash + simple.gain)}
                    </Table.Td>
                    <Table.Td ta="right">
                      {simple.holdEnd === null ? 'n/a' : money(simple.holdEnd)}
                    </Table.Td>
                    <Table.Td ta="right">−{row.outcome.maxDrawdownPct.toFixed(1)}%</Table.Td>
                  </>
                ) : (
                  <Table.Td colSpan={4} c="red">
                    <Text size="xs">{row.error}</Text>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <Text size="xs" c="dimmed" mt="xs">
        ✓ = better than holding that symbol for the goal (return per risk by default), even if it
        made less money.
      </Text>
    </Paper>
  );
}
