import { LEGAL_EMAIL, type LegalDoc } from './legal-types';

/** The accessibility statement (Israeli Standard SI 5568 / WCAG 2.0 AA), at /accessibility. */
export const ACCESSIBILITY: LegalDoc = {
  title: 'Accessibility Statement',
  updated: 'October 27, 2026',
  summary:
    'We want everyone, including people with disabilities, to be able to use Bullwether. We aim for Level AA of Israeli Standard SI 5568 (WCAG 2.0), and the accessibility button on every page opens tools for contrast, text size, reading aids and reading aloud. If something is hard to use, tell us and we will help.',
  sections: [
    {
      id: 'commitment',
      title: '1. Our commitment',
      body: [
        'Bullwether is committed to making the Bullwether website and app accessible to people with disabilities, in accordance with the Equal Rights for Persons with Disabilities Law, 5758-1998, its regulations, and Israeli Standard SI 5568 Part 1, which adopts the Web Content Accessibility Guidelines (WCAG) 2.0 with Israeli modifications.',
      ],
    },
    {
      id: 'target',
      title: '2. Conformance target',
      body: [
        'We aim for Level AA conformance with SI 5568 / WCAG 2.0 AA across the public pages and the logged-in app, on computers and on phones.',
      ],
    },
    {
      id: 'measures',
      title: '3. What we have done',
      body: [
        {
          list: [
            'Semantic page structure with landmarks, headings and labeled form fields.',
            'Keyboard-operable navigation and controls, with visible focus indicators.',
            'Text labels for icon-only buttons and descriptions for meaningful icons.',
            'A layout made for phones, with large touch targets and lists in place of wide tables.',
            'Light and dark modes, and text that can be enlarged without losing content.',
            'Prices, gains and other figures are written out in text next to every chart.',
            'An accessibility toolbar (Open-Nagish) on every page.',
          ],
        },
      ],
    },
    {
      id: 'toolbar',
      title: '4. The accessibility toolbar',
      body: [
        'Use the accessibility button (the figure symbol) at the bottom-right of the screen on a computer, or in the top bar on a phone. It can increase text size and spacing, adjust contrast and colors, highlight links and headings, show a reading guide, use a font for dyslexia, stop animations and read page content aloud, in English, Hebrew, Arabic and Russian. Your toolbar settings are saved in your browser.',
      ],
    },
    {
      id: 'limitations',
      title: '5. Known limitations',
      body: [
        {
          list: [
            'Interactive price charts are visual; the figures they show (latest price, change, your buy price and levels) are also given as text beside them.',
            'Signing in with Alpaca happens on Alpaca’s own pages, whose accessibility is provided by Alpaca.',
            'Some long tables in the Lab (backtests and research) are easier to use on a computer than on a small screen.',
            'This statement is based on our own review; the Service has not yet been audited by an external accessibility expert.',
          ],
        },
      ],
    },
    {
      id: 'contact',
      title: '6. Feedback and contact',
      body: [
        `If you find an accessibility barrier, or need information in another format, contact us at ${LEGAL_EMAIL} (accessibility coordinator: Bullwether). Please describe the page and the problem. We aim to answer within 5 business days and will work with you to give you the information or service you need.`,
      ],
    },
  ],
};
