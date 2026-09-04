# 30-Day GOFAM GROW Challenge

## Challenge objective

**Earn 21 Glow Seeds within 30 days.**

Mission and Hill mechanics are defined separately. The GAP result establishes the initial Hill ranking and Day-1 mapping.

## Core logic

- Each day, the user can complete **3 assigned Missions**.
- Each assigned Mission completed = **100 GoFam Coins**.
- Completing all 3 Missions = **+200 bonus Coins** + **1 Step** on that Hill + **1 Glow Seed** 🌱.
- The user does **not** need to complete Missions for 21 consecutive days.
- They simply need to earn **21 Glow Seeds anytime within the 30-day Challenge period**.
- Any additional Missions beyond the assigned 3 can be completed voluntarily and earn **10 Coins** each.

## Perfect FLOW Week bonus

A FLOW Week runs **Monday–Sunday**.

If the user completes all 3 assigned Missions on all 7 days:

**🌈 PERFECT FLOW WEEK**

They receive:

- **+1,500 GoFam Coins**
- **+3 additional Glow Seeds**

These bonus Glow Seeds count toward the 21-Glow-Seed target.

## Challenge progress

The main progress indicator:

```
🌱 GLOW SEEDS
14 / 21
```

When they reach **21 / 21**:

**30-DAY GOFAM GROW CHALLENGE COMPLETED! 🎉**

Missing a day does **not** reset or punish the user. Consistency simply helps them reach 21 faster.

**3 Missions → 1 Glow Seed → 21 Glow Seeds → Challenge Complete.**

## Implementation notes

| Constant | Value |
|----------|-------|
| `CHALLENGE_PERIOD_DAYS` | 30 |
| `CHALLENGE_GLOW_SEED_TARGET` | 21 |
| `JOURNEY_DAYS` | 30 (assigned mission days per schedule) |
| `DEFAULT_GOFAM_WEEK_START_DAY` | 1 (Monday) |

- Challenge progress is counted from **flow_week ledger seed grants** (`flow_daily_seed:*`, `flow_perfect_week_seeds:*`) within the challenge window — not `seedInventoryCount` (which decreases when sending seeds).
- Challenge window starts at the first main `PersonalWeekSchedule.personalWeekStart` (or GAP `rankingsEffectiveFrom`).
- Legacy 21-day schedules are auto-extended to 30 days on load.
- Missed-day blocking is disabled (`CHALLENGE_DISABLE_MISSED_DAY_BLOCK`) per the no-punishment philosophy.
