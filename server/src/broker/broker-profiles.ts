import { BadRequestException } from '@nestjs/common';
import { PROFILE_ROBUSTNESS } from './profile-robustness.data.js';
import { PROFILE_STATS } from './profile-stats.data.js';
import {
  PROFILES,
  profileById,
  suggestProfile,
  type Profile,
} from './profiles.js';

/** The profile you chose, or the one suggested for the amount. */
export function pickProfile(capital: number, id?: string): Profile {
  const profile = profileById(id ?? suggestProfile(capital).profile);
  if (!profile)
    throw new BadRequestException(
      `No profile "${id}": ${PROFILES.map((p) => p.id).join(', ')}`,
    );
  return profile;
}

/**
 * Every profile, with what it did in the algo lab and what that means for
 * `capital` (the worst drop and worst year in dollars, what it grew to), and
 * the profile suggested for the amount (your rule: more risk for small amounts).
 */
export function profilesFor(capital: number) {
  const suggested = suggestProfile(capital);
  return {
    capital,
    testedAt: PROFILE_STATS.testedAt,
    suggested,
    profiles: PROFILES.map((p) => {
      const stats = PROFILE_STATS.profiles[p.id];
      const robust = PROFILE_ROBUSTNESS.profiles[p.id] ?? null;
      const years = stats
        ? (new Date(stats.to).getTime() - new Date(stats.from).getTime()) /
          (365.25 * 86_400_000)
        : 0;
      return {
        ...p,
        suggested: p.id === suggested.profile,
        stats: stats ?? null,
        /** The usual range over the test's variations (the single run in `stats` is its luckiest setup). */
        robust,
        robustMethod: PROFILE_ROBUSTNESS.method,
        forAmount: stats && {
          /** A usual year in dollars, low and high. */
          usualYear: robust
            ? robust.usualPct.map((x) => (capital * x) / 100)
            : null,
          /** The deepest drop in any variation, in dollars. */
          worstDropAny: robust ? (-capital * robust.worstDropPct) / 100 : null,
          worstDrop: (-capital * stats.maxDrawdownPct) / 100,
          worstYear: (capital * stats.worstYear.pct) / 100,
          typicalYear: (capital * stats.annualPct) / 100,
          /** What the amount grew to over the test (and SPY's, to compare). */
          grewTo: capital * (1 + stats.totalPct / 100),
          spyGrewTo: capital * (1 + stats.spy.totalPct / 100),
          years: Math.round(years * 10) / 10,
        },
      };
    }),
  };
}
