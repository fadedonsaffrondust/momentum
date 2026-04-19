import type { SyncMatchRules } from '@momentum/shared';
import type { TldvMeeting } from './tldv.ts';

export interface ScoredCandidate {
  meeting: TldvMeeting;
  score: number;
  reasons: string[];
  confidence: 'high' | 'low';
}

export function scoreMeeting(
  meeting: TldvMeeting,
  rules: SyncMatchRules,
  syncedIds: string[],
): { score: number; reasons: string[]; hasStakeholderMatch: boolean } {
  if (syncedIds.includes(meeting.id)) {
    return { score: -1000, reasons: ['Already synced'], hasStakeholderMatch: false };
  }

  let score = 0;
  const reasons: string[] = [];
  let hasStakeholderMatch = false;

  // Stakeholder email matching (+50 per match)
  if (rules.stakeholderEmails.length > 0) {
    const lowerEmails = new Set(rules.stakeholderEmails.map((e) => e.toLowerCase()));
    const allParticipants = [meeting.organizer, ...meeting.invitees];
    for (const person of allParticipants) {
      if (person.email && lowerEmails.has(person.email.toLowerCase())) {
        score += 50;
        hasStakeholderMatch = true;
        reasons.push(`${person.name || person.email} (stakeholder) was on this call`);
      }
    }
  }

  // Title keyword matching (+30 per match)
  if (rules.titleKeywords.length > 0) {
    const titleLower = meeting.name.toLowerCase();
    for (const keyword of rules.titleKeywords) {
      if (keyword && titleLower.includes(keyword.toLowerCase())) {
        score += 30;
        reasons.push(`Title contains "${keyword}"`);
      }
    }
  }

  return { score, reasons, hasStakeholderMatch };
}

export function categorizeCandidates(
  meetings: TldvMeeting[],
  rules: SyncMatchRules,
  syncedIds: string[],
): { likely: ScoredCandidate[]; possible: ScoredCandidate[] } {
  const likely: ScoredCandidate[] = [];
  const possible: ScoredCandidate[] = [];

  for (const meeting of meetings) {
    const { score, reasons, hasStakeholderMatch } = scoreMeeting(meeting, rules, syncedIds);

    // Must have at least one positive signal (email or keyword match)
    if (score <= 0) continue;

    if (hasStakeholderMatch) {
      likely.push({ meeting, score, reasons, confidence: 'high' });
    } else if (score >= 30) {
      possible.push({ meeting, score, reasons, confidence: 'low' });
    }
  }

  likely.sort((a, b) => b.score - a.score);
  possible.sort((a, b) => b.score - a.score);

  return { likely, possible };
}
