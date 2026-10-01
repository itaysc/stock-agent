/**
 * 8-K items (the reason a company files one). VETO: severe enough to block a
 * buy (and alert on a holding) by themselves. REVIEW: notable, handed to the
 * AI with the headlines. Other items (agreements, results, votes...) are routine.
 */
export const VETO_ITEMS: Record<string, string> = {
  '1.03': 'bankruptcy or receivership',
  '1.05': 'material cybersecurity incident',
  '3.01': 'delisting notice or failure to meet listing rules',
  '4.02': 'past financial statements can no longer be relied on',
};

export const REVIEW_ITEMS: Record<string, string> = {
  '2.05': 'exit or restructuring costs (e.g. layoffs)',
  '2.06': 'material impairment (a large write-down)',
  '4.01': 'change of auditor',
  '5.02': 'departure or appointment of directors or officers',
};

export const describeItems = (items: string[], table: Record<string, string>) =>
  items
    .filter((i) => table[i])
    .map((i) => `item ${i}: ${table[i]}`)
    .join('; ');
