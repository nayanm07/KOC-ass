import {
  allowedTransitions,
  checkCanDelete,
  checkCanEdit,
  checkCanJoin,
  checkCanLeave,
  checkCanQueue,
  checkStatusTransition,
  formatTimeControl,
  isRoundRobinFinished,
  roundRobinGameCount,
} from './tournament.rules';

describe('tournament rules', () => {
  describe('checkCanJoin', () => {
    const base = { role: 'student' as const, status: 'open' as const, alreadyJoined: false };

    it('lets a student join an open tournament', () => {
      expect(checkCanJoin(base)).toBeNull();
    });

    it('rejects coaches', () => {
      expect(checkCanJoin({ ...base, role: 'coach' })?.code).toBe('ONLY_STUDENTS_CAN_JOIN');
    });

    it('rejects a second join', () => {
      expect(checkCanJoin({ ...base, alreadyJoined: true })?.code).toBe('ALREADY_JOINED');
    });

    it.each(['draft', 'ongoing', 'completed'] as const)('rejects joining a %s tournament', (status) => {
      expect(checkCanJoin({ ...base, status })?.code).toBe('TOURNAMENT_NOT_OPEN');
    });

    it('reports "already joined" before "closed" so the message is accurate', () => {
      expect(checkCanJoin({ ...base, status: 'ongoing', alreadyJoined: true })?.code).toBe('ALREADY_JOINED');
    });
  });

  describe('checkCanLeave', () => {
    it('allows leaving before the start', () => {
      expect(checkCanLeave({ status: 'open', joined: true })).toBeNull();
    });
    it('rejects leaving when not joined', () => {
      expect(checkCanLeave({ status: 'open', joined: false })?.code).toBe('NOT_JOINED');
    });
    it('rejects leaving once started', () => {
      expect(checkCanLeave({ status: 'ongoing', joined: true })?.code).toBe('TOURNAMENT_NOT_OPEN');
    });
  });

  describe('checkCanQueue', () => {
    it('allows participants of an ongoing tournament', () => {
      expect(checkCanQueue({ status: 'ongoing', joined: true })).toBeNull();
    });
    it('rejects non-participants', () => {
      expect(checkCanQueue({ status: 'ongoing', joined: false })?.code).toBe('NOT_JOINED');
    });
    it.each(['draft', 'open', 'completed'] as const)('rejects queueing in a %s tournament', (status) => {
      expect(checkCanQueue({ status, joined: true })?.code).toBe('TOURNAMENT_NOT_ONGOING');
    });
    it('round robin: allows queueing while opponents are left', () => {
      expect(checkCanQueue({ status: 'ongoing', joined: true, opponentsLeft: 1 })).toBeNull();
    });
    it('round robin: rejects once you have played everyone', () => {
      expect(checkCanQueue({ status: 'ongoing', joined: true, opponentsLeft: 0 })?.code).toBe(
        'ROUND_ROBIN_DONE',
      );
    });
  });

  describe('round robin', () => {
    it('needs n(n−1)/2 games', () => {
      expect([1, 2, 3, 4, 6].map(roundRobinGameCount)).toEqual([0, 1, 3, 6, 15]);
    });
    it('finishes only when every game is done and nothing is live', () => {
      expect(isRoundRobinFinished({ players: 4, completedGames: 6, liveGames: 0 })).toBe(true);
      expect(isRoundRobinFinished({ players: 4, completedGames: 5, liveGames: 0 })).toBe(false);
      expect(isRoundRobinFinished({ players: 4, completedGames: 5, liveGames: 1 })).toBe(false);
      expect(isRoundRobinFinished({ players: 1, completedGames: 0, liveGames: 0 })).toBe(false);
    });
  });

  describe('checkStatusTransition', () => {
    const ctx = { participantCount: 4, liveMatchCount: 0 };

    it.each([
      ['draft', 'open'],
      ['open', 'ongoing'],
      ['ongoing', 'completed'],
    ] as const)('allows %s → %s', (from, to) => {
      expect(checkStatusTransition(from, to, ctx)).toBeNull();
    });

    it.each([
      ['draft', 'ongoing'],
      ['draft', 'completed'],
      ['open', 'completed'],
      ['ongoing', 'open'],
      ['completed', 'ongoing'],
      ['completed', 'draft'],
    ] as const)('rejects %s → %s', (from, to) => {
      expect(checkStatusTransition(from, to, ctx)?.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('rejects a no-op transition', () => {
      expect(checkStatusTransition('open', 'open', ctx)?.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('allows open → draft only with no participants', () => {
      expect(checkStatusTransition('open', 'draft', { ...ctx, participantCount: 0 })).toBeNull();
      expect(checkStatusTransition('open', 'draft', ctx)?.code).toBe('TOURNAMENT_HAS_PARTICIPANTS');
    });

    it('needs at least 2 participants to start', () => {
      expect(checkStatusTransition('open', 'ongoing', { ...ctx, participantCount: 1 })?.code).toBe(
        'NOT_ENOUGH_PARTICIPANTS',
      );
      expect(checkStatusTransition('open', 'ongoing', { ...ctx, participantCount: 2 })).toBeNull();
    });

    it('cannot complete while games are live', () => {
      expect(checkStatusTransition('ongoing', 'completed', { ...ctx, liveMatchCount: 1 })?.code).toBe(
        'TOURNAMENT_HAS_LIVE_MATCHES',
      );
    });

    it('completed is final', () => {
      expect(allowedTransitions('completed')).toEqual([]);
    });
  });

  describe('checkCanEdit', () => {
    it('allows any edit before the start', () => {
      expect(checkCanEdit('draft', { schedule: true, timeControl: true })).toBeNull();
      expect(checkCanEdit('open', { schedule: true, timeControl: true })).toBeNull();
    });
    it('locks the format once ongoing', () => {
      expect(checkCanEdit('ongoing', { schedule: false, timeControl: false, format: true })?.code).toBe(
        'TOURNAMENT_LOCKED',
      );
    });
    it('locks schedule and time control once ongoing, but allows renaming', () => {
      expect(checkCanEdit('ongoing', { schedule: false, timeControl: true })?.code).toBe('TOURNAMENT_LOCKED');
      expect(checkCanEdit('ongoing', { schedule: true, timeControl: false })?.code).toBe('TOURNAMENT_LOCKED');
      expect(checkCanEdit('ongoing', { schedule: false, timeControl: false })).toBeNull();
    });
    it('rejects edits to a completed tournament', () => {
      expect(checkCanEdit('completed', { schedule: false, timeControl: false })?.code).toBe(
        'TOURNAMENT_COMPLETED',
      );
    });
  });

  describe('checkCanDelete', () => {
    it.each(['draft', 'open'] as const)('allows deleting a %s tournament', (status) => {
      expect(checkCanDelete(status)).toBeNull();
    });
    it.each(['ongoing', 'completed'] as const)('protects a %s tournament', (status) => {
      expect(checkCanDelete(status)?.code).toBe('TOURNAMENT_HAS_STARTED');
    });
  });

  describe('formatTimeControl', () => {
    it('formats minutes+increment', () => {
      expect(formatTimeControl(300, 0)).toBe('5+0');
      expect(formatTimeControl(180, 2)).toBe('3+2');
      expect(formatTimeControl(90, 1)).toBe('1.5+1');
    });
  });
});
