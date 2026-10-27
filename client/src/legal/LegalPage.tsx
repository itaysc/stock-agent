import {
  Anchor,
  Box,
  Container,
  Group,
  List,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconChartLine } from '@tabler/icons-react';
import { useEffect } from 'react';
import { ACCESSIBILITY } from './accessibility';
import type { LegalDoc } from './legal-types';
import { PRIVACY } from './privacy';
import { TERMS } from './terms';

/** The legal page for an address (/terms, /policy, /privacy), or null for the app. */
export function legalDocFor(path: string): LegalDoc | null {
  const p = path.replace(/\/+$/, '');
  if (p === '/terms') return TERMS;
  if (p === '/policy' || p === '/privacy') return PRIVACY;
  if (p === '/accessibility') return ACCESSIBILITY;
  return null;
}

/** A legal document, readable without logging in: the summary, contents, then every section. */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  // A link to a section (/policy#rights): the page is drawn after the browser looked for it.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);
  // The other legal pages, linked at the top and bottom.
  const links = (
    <Group gap="md">
      {[
        { doc: TERMS, href: '/terms', label: 'Terms of Use' },
        { doc: PRIVACY, href: '/policy', label: 'Privacy Policy' },
        { doc: ACCESSIBILITY, href: '/accessibility', label: 'Accessibility' },
      ]
        .filter((o) => o.doc !== doc)
        .map((o) => (
          <Anchor key={o.href} href={o.href} size="sm">
            {o.label}
          </Anchor>
        ))}
    </Group>
  );
  return (
    <Container size="md" py="xl" px="md">
      <Stack gap="lg">
        <Group justify="space-between" wrap="nowrap">
          <Anchor href="/" underline="never" c="inherit">
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon
                size={34}
                radius="md"
                variant="gradient"
                gradient={{ from: 'indigo', to: 'cyan' }}
              >
                <IconChartLine size={20} />
              </ThemeIcon>
              <Text fw={700}>Bullwether</Text>
            </Group>
          </Anchor>
          {links}
        </Group>
        <div>
          <Title order={1}>{doc.title}</Title>
          <Text c="dimmed" size="sm">
            Last updated: {doc.updated}
          </Text>
        </div>
        <Paper p="md" withBorder bg="var(--mantine-color-default-hover)">
          <Text size="sm" fw={600}>
            {doc.summary}
          </Text>
        </Paper>
        <Box component="nav" aria-label="Contents">
          <Text fw={600} mb={4}>
            Contents
          </Text>
          <List size="sm" spacing={2} listStyleType="none">
            {doc.sections.map((s) => (
              <List.Item key={s.id}>
                <Anchor href={`#${s.id}`} size="sm">
                  {s.title}
                </Anchor>
              </List.Item>
            ))}
          </List>
        </Box>
        {doc.sections.map((s) => (
          <section key={s.id} id={s.id} style={{ scrollMarginTop: 16 }}>
            <Title order={3} mb="xs">
              {s.title}
            </Title>
            <Stack gap="sm">
              {s.body.map((b, i) =>
                typeof b === 'string' ? (
                  <Text key={i} size="sm" lh={1.65}>
                    {b}
                  </Text>
                ) : (
                  <List key={i} size="sm" spacing={6} withPadding>
                    {b.list.map((item) => (
                      <List.Item key={item} style={{ lineHeight: 1.6 }}>
                        {item}
                      </List.Item>
                    ))}
                  </List>
                ),
              )}
            </Stack>
          </section>
        ))}
        <Group
          justify="space-between"
          pt="md"
          style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
        >
          <Anchor href="/" size="sm">
            Back to Bullwether
          </Anchor>
          {links}
        </Group>
      </Stack>
    </Container>
  );
}
