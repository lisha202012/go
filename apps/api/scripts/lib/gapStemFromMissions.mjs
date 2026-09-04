/**
 * Builds category-specific GAP stems from missions-945.json group missions.
 * Each category gets unique wording (not duplicated placeholder strings).
 *
 * GROUP 5 (reverse-scored) RULE: Q5 must reflect that hill's actual mission group 5
 * theme from missions-945.json — NOT a generic "reversed connection" stem copied
 * across hills. Examples:
 *   HOPE G5 → repair/reconciliation after tension (Take the First Step, Own Your Part, Reconnect)
 *   HONE G5 → prevention / long-term health protection (not "repair")
 *   HOLD G5 → purposeful spending vs priorities
 *   etc. — derive per hill from GROUP_THEMES + mission titles, never assume "repair".
 */
import { classifyQuestion } from './gapMissionMappingAudit.mjs';

const CHILD_REF = {
  S1E: 'my baby or toddler',
  S1G: 'my preschooler',
  S1R: 'my child starting school',
  A2: 'my school-age child',
  B3: 'my tween',
  C4: 'my teenager',
};

const PARENT_CATEGORIES = new Set(['S1E', 'S1G', 'S1R', 'A2', 'B3', 'C4']);

function missionPhrase(missions, index = 0) {
  return missions[index]?.title?.toLowerCase() ?? 'this practice';
}

/** @returns {string} */
export function buildGapStem(categoryCode, hillCode, group, missions) {
  const child = CHILD_REF[categoryCode];
  const m0 = missionPhrase(missions, 0);
  const m1 = missionPhrase(missions, 1);
  const m2 = missionPhrase(missions, 2);

  const builders = {
    HOPE: {
      1: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I spent warm, face-to-face time with ${child}, followed their lead in play, and welcomed them when we reunited.`
          : categoryCode === 'N7'
            ? `I made meaningful time to connect with family members, reached out first, and chose connection over distraction.`
            : categoryCode === 'D5'
              ? `I stayed connected with people I care about through quality time, reaching out first and choosing real conversation over screens.`
              : `I stayed connected with family members and people I care about through meaningful quality time and conversation.`,
      2: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I listened carefully before responding to ${child} and expressed appreciation for how they communicate.`
          : categoryCode === 'N7'
            ? `I listened fully before responding to a family member and told them something specific I appreciate about them.`
            : categoryCode === 'D5'
              ? `I listened carefully before responding to someone close to me and expressed genuine appreciation.`
              : `I listened carefully before responding to someone and expressed appreciation for something specific.`,
      3: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I did something kind for ${child} or let them see me do a caring act without expecting anything in return.`
          : categoryCode === 'N7'
            ? `I did something kind for a family member without expecting anything in return.`
            : categoryCode === 'D5'
              ? `I did something kind for someone without expecting anything in return.`
              : `I did something kind without expecting anything in return.`,
      4: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I checked in on ${child} when I thought they might need encouragement or support.`
          : categoryCode === 'N7'
            ? `I checked in on a family member when I thought they might need encouragement or support.`
            : categoryCode === 'D5'
              ? `I checked in on someone when I thought they might need encouragement or support.`
              : `I checked in on someone when I thought they might need encouragement or support.`,
      5: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I avoided apologizing or taking the first step to reconnect when I knew ${child} and I needed repair.`
          : categoryCode === 'N7'
            ? `I avoided apologizing or taking the first step to reconnect when I knew I had hurt a family member.`
            : categoryCode === 'D5'
              ? `I avoided owning my part or taking the first step to reconnect when I knew I had hurt someone I care about.`
              : `I avoided apologizing or taking the first step to reconnect when I knew I had hurt someone I care about.`,
    },
    HONE: {
      1: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? categoryCode === 'S1E'
            ? `I protected sleep and rest for ${child} and for myself.`
            : `I gave ${child} and myself enough sleep and rest.`
          : categoryCode === 'N7'
            ? `I gave my body enough sleep and rest so I can show up well for my family.`
            : categoryCode === 'D5'
              ? `I gave my body enough sleep and rest while managing a busy season of change.`
              : `I gave my body enough sleep and rest.`,
      2: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I moved my body through physical activity with ${child} or on my own most days.`
          : categoryCode === 'N7'
            ? `I moved my body through physical activity to protect my long-term health for my family.`
            : categoryCode === 'D5'
              ? `I moved my body through physical activity on most days, even when my schedule was full.`
              : `I moved my body through physical activity on most days.`,
      3: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I kept ${categoryCode === 'S1E' ? child : 'myself and ' + child} adequately hydrated and nourished with regular meals.`
          : categoryCode === 'N7'
            ? `I kept myself adequately hydrated and ate meals that gave me steady energy for family life.`
            : categoryCode === 'D5'
              ? `I kept myself adequately hydrated and ate meals that gave me steady energy through the day.`
              : `I kept myself adequately hydrated and ate meals that gave me steady energy.`,
      4: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I noticed early signs of stress while caring for ${child} and used a healthy reset before it built up.`
          : categoryCode === 'N7'
            ? `I noticed early signs of stress and used a healthy reset before it built up while caring for others.`
            : categoryCode === 'D5'
              ? `I noticed early signs of stress and used a healthy reset before it built up during a demanding week.`
              : `I noticed early signs of stress and used a healthy reset before it built up.`,
      5: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I neglected long-term health prevention for myself even when I knew a small step would help future me care for ${child}.`
          : categoryCode === 'N7'
            ? `I neglected long-term health prevention even when I knew it would affect my ability to support my family.`
            : categoryCode === 'D5'
              ? `I neglected long-term health prevention even when I knew a small step would help future me.`
              : `I neglected long-term health prevention even when I knew a small step would help future me.`,
    },
    HOLD: {
      1: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I tracked where our household money went, including spending related to ${child}.`
          : categoryCode === 'N7'
            ? `I tracked where my money went and reviewed our household finances.`
            : categoryCode === 'D5'
              ? `I tracked where my money went for important expenses as I manage early-adult finances.`
              : `I tracked where my money went for important expenses.`,
      2: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I paused before a purchase and considered whether it was worth the cost for our family.`
          : categoryCode === 'N7'
            ? `I considered whether something was worth the cost before choosing it for our household.`
            : categoryCode === 'D5'
              ? `I considered whether something was worth the cost before choosing it on a limited budget.`
              : `I considered whether something was worth the cost before choosing it.`,
      3: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I protected money I had decided to save for our family's future needs.`
          : categoryCode === 'N7'
            ? `I protected money I had decided to save for family needs or goals.`
            : categoryCode === 'D5'
              ? `I protected money I had decided to save toward a future need or goal.`
              : `I protected money I had decided to save.`,
      4: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I prepared ahead for future expenses our family expects, including costs related to ${child}.`
          : categoryCode === 'N7'
            ? `I prepared ahead for future household expenses or needs.`
            : categoryCode === 'D5'
              ? `I prepared ahead for future expenses or needs I can see coming.`
              : `I prepared ahead for future expenses or needs.`,
      5: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I spent on our household without thinking about whether it matched my priorities.`
          : categoryCode === 'N7'
            ? `I spent on family needs without thinking about whether it matched my priorities.`
            : categoryCode === 'D5'
              ? `I spent without thinking about whether it matched my priorities.`
              : `I spent without thinking about whether it matched my priorities.`,
    },
    HOOD: {
      1: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I paused before acting when my emotions were strong while caring for ${child} and noticed how I was feeling.`
          : categoryCode === 'N7'
            ? `I paused before acting when my emotions were strong and reflected on how I was feeling.`
            : categoryCode === 'D5'
              ? `I paused before acting when my emotions were strong and named what I was feeling.`
              : `I paused before acting when my emotions were strong and noticed how I was feeling.`,
      2: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I kept a commitment or promise I made to ${child} or our family.`
          : categoryCode === 'N7'
            ? `I kept a commitment I made to my family.`
            : categoryCode === 'D5'
              ? `I kept a commitment I made to myself or someone I care about.`
              : `I kept a commitment I made to myself or someone I care about.`,
      3: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `My actions matched the values I want ${child} to see me live by.`
          : categoryCode === 'N7'
            ? `My actions matched the values I want my family to see me live by.`
            : categoryCode === 'D5'
              ? `My actions matched the values I expect from myself as I grow into adulthood.`
              : `My actions matched the values I expect from myself.`,
      4: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I paused before reacting when I felt overwhelmed caring for ${child} and used a healthy outlet to recover.`
          : categoryCode === 'N7'
            ? `I paused before reacting when I felt overwhelmed and used a healthy outlet to recover while supporting my family.`
            : categoryCode === 'D5'
              ? `I paused before reacting when I felt overwhelmed and used a healthy outlet to recover.`
              : `I paused before reacting when I felt overwhelmed and used a healthy outlet to recover.`,
      5: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I let personal boundaries slip when keeping them would have been inconvenient for ${child} or me.`
          : categoryCode === 'N7'
            ? `I let personal boundaries slip when keeping them would have been inconvenient for my family or me.`
            : categoryCode === 'D5'
              ? `I let personal boundaries slip when keeping them would have been inconvenient.`
              : `I let personal boundaries slip when keeping them would have been inconvenient.`,
    },
    HOST: {
      1: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I followed through on something I agreed to take care of at home for ${child}.`
          : categoryCode === 'N7'
            ? `I followed through on something I agreed to take care of at home for my family.`
            : categoryCode === 'D5'
              ? `I followed through on something I agreed to take care of at home or in shared living.`
              : `I followed through on something I agreed to take care of at home.`,
      2: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I helped at home with ${m0} without always waiting to be asked.`
          : categoryCode === 'N7'
            ? `I helped at home without always waiting to be asked, even when others needed support too.`
            : categoryCode === 'D5'
              ? `I helped at home or in shared spaces without always waiting to be asked.`
              : `I helped at home without always waiting to be asked.`,
      3: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I cared for belongings or did simple maintenance to keep our home working well for ${child}.`
          : categoryCode === 'N7'
            ? `I cared for belongings or did simple maintenance to keep our home working well.`
            : categoryCode === 'D5'
              ? `I cared for belongings or did simple maintenance where I live.`
              : `I cared for belongings or did simple maintenance at home.`,
      4: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I reset or organised a shared space so our home felt clean and comfortable for ${child}.`
          : categoryCode === 'N7'
            ? `I reset or organised a shared space so our home felt clean and comfortable for everyone.`
            : categoryCode === 'D5'
              ? `I reset or organised a shared space so my living environment felt comfortable.`
              : `I reset or organised a shared space so my living environment felt comfortable.`,
      5: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I neglected a household issue at home or left a shared space worse than I found it.`
          : categoryCode === 'N7'
            ? `I neglected a household issue our family relies on or left a shared space worse than I found it.`
            : categoryCode === 'D5'
              ? `I neglected a household issue I could reasonably have handled or left a shared space worse than I found it.`
              : `I neglected a household issue or left a shared space worse than I found it.`,
    },
    HORN: {
      1: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I had a clear sense of one priority or challenge I am working towards for ${child} and our family.`
          : categoryCode === 'N7'
            ? `I had a clear sense of one priority or challenge I am working towards for my family.`
            : categoryCode === 'D5'
              ? `I had a clear sense of one priority or challenge I am working towards in this season of life.`
              : `I had a clear sense of one priority or challenge I am working towards.`,
      2: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I acted on an important priority for ${child} or our family rather than only thinking about it.`
          : categoryCode === 'N7'
            ? `I acted on an important priority for my family rather than only thinking about it.`
            : categoryCode === 'D5'
              ? `I acted on an important priority rather than only thinking about it.`
              : `I acted on an important priority rather than only thinking about it.`,
      3: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I returned to an important goal for ${child} or our family after a setback and tried again.`
          : categoryCode === 'N7'
            ? `I returned to an important family goal after a setback and tried again.`
            : categoryCode === 'D5'
              ? `I returned to an important goal after a setback and tried again.`
              : `I returned to an important goal after a setback and tried again.`,
      4: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I asked for or used feedback to learn and improve in how I support ${child}.`
          : categoryCode === 'N7'
            ? `I asked for or used feedback to learn and improve in my role supporting my family.`
            : categoryCode === 'D5'
              ? `I asked for or used feedback to learn and improve on something that matters to me.`
              : `I asked for or used feedback to learn and improve on something that matters.`,
      5: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I avoided feedback or a challenging step that would have helped me grow as a parent to ${child}.`
          : categoryCode === 'N7'
            ? `I avoided feedback or a challenging step that would have helped me grow in supporting my family.`
            : categoryCode === 'D5'
              ? `I avoided feedback or a challenging step that would have helped me grow.`
              : `I avoided feedback or a challenging step that would have helped me grow.`,
    },
    HOOK: {
      1: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I planned my time so there was room for important things, including time with ${child}.`
          : categoryCode === 'N7'
            ? `I planned my time so there was room for important family priorities.`
            : categoryCode === 'D5'
              ? `I planned my time so there was room for important personal and family priorities.`
              : `I planned my time so there was room for important things.`,
      2: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I focused on one task at a time without unnecessary distractions while caring for ${child}.`
          : categoryCode === 'N7'
            ? `I focused on one task at a time without unnecessary distractions or multitasking at home.`
            : categoryCode === 'D5'
              ? `I focused on one task at a time without unnecessary distractions when studying or working.`
              : `I focused on one task at a time without unnecessary distractions or multitasking.`,
      3: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I finished something important I started for ${child} or our home instead of leaving it undone.`
          : categoryCode === 'N7'
            ? `I finished something important I started for my family instead of leaving it undone.`
            : categoryCode === 'D5'
              ? `I finished something important I started instead of leaving it undone.`
              : `I finished something important I started instead of leaving it undone.`,
      4: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I gave my full attention to ${child} or the person in front of me rather than splitting my presence.`
          : categoryCode === 'N7'
            ? `I gave my full attention to the family member in front of me rather than splitting my presence.`
            : categoryCode === 'D5'
              ? `I gave my full attention to the person in front of me rather than splitting my presence.`
              : `I gave my full attention to the person in front of me rather than splitting my presence.`,
      5: () =>
        PARENT_CATEGORIES.has(categoryCode)
          ? `I was unnecessarily impatient with ${child} when I needed to wait.`
          : categoryCode === 'N7'
            ? `I was unnecessarily impatient with a family member when I needed to wait.`
            : categoryCode === 'D5'
              ? `I was unnecessarily impatient when I needed to wait for something or someone.`
              : `I was unnecessarily impatient when I needed to wait for something or someone.`,
    },
  };

  const builder = builders[hillCode]?.[group];
  if (!builder) {
    throw new Error(`No stem builder for ${hillCode} G${group}`);
  }

  const text = builder();
  const { status } = classifyQuestion(hillCode, group, text);
  if (status === 'mismatch' || status === 'unclassified') {
    throw new Error(
      `Stem failed theme check for ${categoryCode} ${hillCode} G${group}: "${text}" (${status})`,
    );
  }
  return text;
}
