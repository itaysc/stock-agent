/** A paragraph, or a bulleted list. */
export type Block = string | { list: string[] };

export interface LegalSection {
  id: string;
  title: string;
  body: Block[];
}

export interface LegalDoc {
  title: string;
  /** Shown as "Last updated". */
  updated: string;
  /** In capitals at the top: what the reader must know first. */
  summary: string;
  sections: LegalSection[];
}

/** The terms version a user accepts at sign-up (recorded on the server: TERMS_VERSION). */
export const TERMS_VERSION = '2026-10-28';
export const LEGAL_EMAIL = 'legal@bullwether.com';
