export type RollbackGuardInput = {
  flowLockstepSteps: number;
  lockstepStepsAtMigration: number;
  postCutoverAwardRows: number;
};

export type RollbackGuardResult =
  | { allowed: true }
  | { allowed: false; reason: string };

/** Refuse rollback when user earned v2 Step awards after cutover unless --force. */
export function evaluateRollbackGuard(input: RollbackGuardInput): RollbackGuardResult {
  const earnedV2Progress =
    input.flowLockstepSteps > input.lockstepStepsAtMigration &&
    input.postCutoverAwardRows > 0;

  if (earnedV2Progress) {
    return {
      allowed: false,
      reason: `User has v2 progress (flowLockstepSteps=${input.flowLockstepSteps} > migration baseline ${input.lockstepStepsAtMigration}, ${input.postCutoverAwardRows} post-cutover award row(s))`,
    };
  }

  return { allowed: true };
}
