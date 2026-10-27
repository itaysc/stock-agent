import { LEGAL_EMAIL, type LegalSection } from './legal-types';

/** Privacy Policy, sections 1–5 (who we are, what we collect, why, who receives it). */
export const PRIVACY_A: LegalSection[] = [
  {
    id: 'about',
    title: '1. About this policy',
    body: [
      `This Privacy Policy explains how Bullwether ("we", "us") collects, uses, shares and protects personal information when you use the Bullwether website and app (the "Service"), and the choices and rights you have. We are the controller (database owner) of this information. Contact: ${LEGAL_EMAIL}.`,
      'We handle personal information in accordance with applicable privacy laws, including the Israeli Privacy Protection Law, 5741-1981 and its regulations, and, where they apply to you, the EU and UK General Data Protection Regulations (GDPR).',
    ],
  },
  {
    id: 'collect',
    title: '2. Information we collect',
    body: [
      {
        list: [
          'User details: your email address, and a one-way hash of your password (we never store the password itself). If you sign up with Alpaca, we receive an access token and your Alpaca account number; Alpaca does not share your Alpaca password with us.',
          'Brokerage credentials: API keys and secrets you enter, or access tokens from Log in with Alpaca. They are stored encrypted (AES-256-GCM) and are never shown again or sent to your browser.',
          'Brokerage account data, retrieved from your broker: account number and status, cash and equity, positions, orders and fills, and account activity (such as trades, dividends, fees and transfers).',
          'Data you create in the Service: investments and their settings, your stocks, stop and target prices, watchlists, ideas and answers, and records of what the Service did (events, orders and their results).',
          'Tax records: your account activity with the Bank of Israel exchange rate of its day and amounts in shekels.',
          'Technical information: server logs with your IP address, the requests made, times and errors; and failed login attempts (by IP address) to protect against password guessing.',
        ],
      },
      'We do not collect government ID numbers, bank or card details, or your location, and we do not knowingly collect special categories of sensitive information.',
    ],
  },
  {
    id: 'use',
    title: '3. How we use it',
    body: [
      {
        list: [
          'To provide the Service: connect your accounts, place and track the orders you authorize, show your data, sync with your broker (including after each login) and keep tax records.',
          'To keep the Service and your accounts secure, prevent abuse, and investigate problems.',
          'To communicate with you about the Service, including changes to our terms.',
          'To maintain and improve the Service.',
          'To comply with law and enforce our Terms.',
        ],
      },
      'We do not sell your personal information, we do not use it for advertising, and we do not build marketing profiles.',
      'Where the GDPR applies, our legal bases are: performing our contract with you (providing the Service), our legitimate interests (security, abuse prevention and improving the Service), your consent where we ask for it, and complying with legal obligations.',
    ],
  },
  {
    id: 'share',
    title: '4. Who receives it',
    body: [
      {
        list: [
          'Your broker (Alpaca Securities LLC and its affiliates): your instructions and orders, and requests for your account data, sent with your credentials.',
          'Service providers that host and run the Service for us (such as application hosting, web hosting and database hosting providers), bound to process the information only for providing their services.',
          'AI model providers (such as OpenAI): only market information, such as stock symbols, news headlines, earnings figures and backtest results. We do not send your email, credentials or account balances.',
          'The content delivery network jsDelivr, which serves the accessibility toolbar and its font: it receives standard request information such as your IP address.',
          'Market-data and public-information sources (such as Alpaca market data, Alpha Vantage, the US SEC, Nasdaq and the Bank of Israel): requests for prices, news, filings and rates, which contain no personal information.',
          'The administrator of the Service, who can access users and connected accounts to operate, secure and support the Service.',
          'Authorities or others when required by law or legal process, or when needed to protect rights, safety or the Service; and a successor in a merger, acquisition or reorganization, bound by this policy.',
        ],
      },
    ],
  },
  {
    id: 'cookies',
    title: '5. Cookies and storage on your device',
    body: [
      'We do not use advertising or third-party tracking cookies or analytics. We use two kinds of cookies and browser storage, and ask for your choice in a banner on your first visit:',
      {
        list: [
          'Strictly necessary (always on): the login cookie that keeps you logged in (httpOnly; by default for 12 hours); short-lived Log in with Alpaca cookies (a security value for the trip to Alpaca and back, 10 minutes, and a sign-up waiting for its email step, 15 minutes); the account you chose to view; a short message after switching accounts; your cookie choice itself; the settings you choose in the accessibility toolbar; and the app files saved by the app (service worker) so it opens quickly and offline (no account data is saved this way).',
          'Functional (only if you allow it): remembering your light or dark mode and whether the sidebar is open. If you do not allow it, these reset on each visit.',
        ],
      },
      'Your choice is saved in your browser and, when you are logged in, in your user record on our server, with the date and the version of this cookie policy. You can change it at any time from the Cookie preferences link at the bottom of the app; if we change the kinds of cookies we use, we will ask again.',
    ],
  },
];
