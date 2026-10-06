import { List, Text } from '@mantine/core';

/** The rules it follows after buying, in plain words. */
export function SellRules({ params }: { params: Record<string, string> }) {
  const stop = Number(params.stopPct ?? 0);
  const take = Number(params.takeProfitPct ?? 0);
  return (
    <div>
      <Text size="sm" fw={600}>
        After buying, it sells a stock when:
      </Text>
      <List size="sm" spacing={2}>
        {stop > 0 && (
          <List.Item>
            <b>Stop loss:</b> a close {stop}% below its highest close since the buy. The stop only
            moves up, so once a stock has risen it also locks in the gain.
          </List.Item>
        )}
        {take > 0 && (
          <List.Item>
            <b>Take profit:</b> it is up {take}% from the buy price.
          </List.Item>
        )}
        <List.Item>
          <b>It weakens:</b> at the weekly re-check it is no longer in the top {params.topN ?? 5},
          or no longer rising.
        </List.Item>
        <List.Item>
          <b>Breaking news:</b> severe news about it (confirmed by the AI reader).
        </List.Item>
        <List.Item>
          <b>A bad earnings report:</b> a clear miss against what analysts expected, or a lower
          forecast (read by the AI). It then stays out for 30 days.
        </List.Item>
      </List>
      {!(take > 0) && (
        <Text size="xs" c="dimmed">
          No fixed profit target: winners are allowed to run (in testing, take-profits cut the best
          winners short); the rising stop protects the gains instead.
        </Text>
      )}
    </div>
  );
}
