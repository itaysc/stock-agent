import { DatePickerInput } from '@mantine/dates';
import type { UseFormReturnType } from '@mantine/form';
import { IconCalendar } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { DATE, type FormValues } from '../../lib/form';

interface Props {
  form: UseFormReturnType<FormValues>;
  /** Earliest date the data feed has. */
  dataStart: string;
}

export function PeriodField({ form, dataStart }: Props) {
  const today = dayjs().format(DATE);
  const back = (years: number) => {
    const from = dayjs().subtract(years, 'year').format(DATE);
    return from < dataStart ? dataStart : from;
  };
  const presets: Array<{ label: string; value: [string, string] }> = [
    { label: 'Last year', value: [back(1), today] },
    { label: 'Last 2 years', value: [back(2), today] },
    { label: 'Last 3 years', value: [back(3), today] },
    { label: 'Last 5 years', value: [back(5), today] },
    {
      label: 'Year to date',
      value: [dayjs().startOf('year').format(DATE), today],
    },
    { label: `All data (since ${dataStart})`, value: [dataStart, today] },
  ];

  return (
    <DatePickerInput
      type="range"
      label="Period"
      description={`History available from ${dataStart}`}
      leftSection={<IconCalendar size={16} />}
      valueFormat="MMM D, YYYY"
      minDate={dataStart}
      maxDate={today}
      presets={presets}
      allowSingleDateInRange={false}
      value={form.values.period}
      onChange={(value) => form.setFieldValue('period', [value[0] ?? null, value[1] ?? null])}
    />
  );
}
