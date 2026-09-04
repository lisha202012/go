import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const hills = [
  {
    code: 'HOPE',
    questions: [
      'I stayed connected with family members and people I care about, even when life was busy.',
      'I did something kind without expecting anything in return.',
      'I listened carefully before responding to someone.',
      'I checked in on someone when I thought they might need encouragement.',
      'I avoided spending quality time with people I care about.',
      'I made time for meaningful conversation with someone close to me.',
      "I apologised when I knew I had hurt someone's feelings.",
      "I celebrated someone else's success without comparing myself.",
      'I spoke respectfully even when I disagreed.',
      'I ignored messages or calls from people who matter to me.',
      'I showed patience when someone needed extra support.',
      'I expressed appreciation to someone who helps me.',
      'I kept a commitment I made to a family member or friend.',
      'I worked through a disagreement without shutting people out.',
      'I was dismissive when someone tried to share with me.',
    ],
  },
  {
    code: 'HONE',
    questions: [
      'I gave my body enough sleep and rest.',
      'I kept myself adequately hydrated.',
      'I moved my body in ways that support my health.',
      'I followed routines that help protect my long-term health.',
      'I avoided physical activity even when I had a reasonable opportunity to move.',
      'I ate meals that gave me steady energy through the day.',
      'I noticed early signs of stress and responded before they built up.',
      'I limited habits that I know harm my health.',
      'I took breaks when my body or mind needed rest.',
      'I skipped meals or sleep when I knew I needed them.',
      'I chose water or nourishing drinks over excessive caffeine or sugar.',
      'I stretched or moved after long periods of sitting.',
      'I followed through on a health-related goal I had set.',
      'I treated illness or pain with appropriate care instead of ignoring it.',
      'I pushed through exhaustion when rest was the better choice.',
    ],
  },
  {
    code: 'HOLD',
    questions: [
      'I considered whether something was worth the cost before choosing it.',
      'I protected money I had decided to save.',
      'I prepared ahead for future expenses or needs.',
      'I considered the future impact of important financial decisions.',
      'I used money or resources without paying attention to where they went.',
      'I tracked where my money was going for important expenses.',
      'I delayed a purchase when I was not sure I could afford it.',
      'I put something aside for a future need or goal.',
      'I compared prices or options before a significant purchase.',
      'I made impulse purchases I later regretted.',
      'I paid bills or obligations on time.',
      'I talked openly about money decisions with people who should be involved.',
      'I used a budget or spending plan to guide my choices.',
      'I avoided unnecessary debt or high-interest borrowing.',
      'I spent without thinking about whether it matched my priorities.',
    ],
  },
  {
    code: 'HOOD',
    questions: [
      'I paused before acting when my emotions were strong.',
      'I used healthy ways to recover from stress.',
      'I protected reasonable limits around my time, energy, relationships, or wellbeing.',
      'My actions matched the values I expect from myself.',
      'I repeatedly abandoned personal commitments when they became inconvenient.',
      'I named my feelings instead of letting them drive my actions blindly.',
      'I chose a healthy outlet when I felt overwhelmed.',
      'I forgave myself after a mistake instead of dwelling on it.',
      'I set a boundary that protected my wellbeing.',
      'I spoke harshly to myself in ways I would not use with others.',
      'I took time to reflect on what matters most to me.',
      'I reached out for support when I needed it.',
      'I made a choice that aligned with my long-term wellbeing over short-term comfort.',
      'I noticed when I was running on empty and adjusted before burning out.',
      'I ignored warning signs that I was overstressed or depleted.',
    ],
  },
  {
    code: 'HOST',
    questions: [
      'I followed through when I agreed to take care of something at home.',
      'I helped at home without always waiting to be asked.',
      'I kept important belongings and living spaces reasonably organised.',
      'I helped keep my living environment clean, comfortable, and pleasant.',
      'I neglected belongings or household issues I could reasonably have taken care of.',
      'I put things back where they belong after using them.',
      'I shared responsibility for meals or household routines.',
      'I fixed or reported something broken instead of leaving it for someone else.',
      'I made our home feel welcoming for the people who live there or visit.',
      'I left messes for others to clean up when I could have handled them.',
      'I prepared ahead so mornings or busy days ran more smoothly at home.',
      "I respected shared spaces and other people's belongings.",
      'I completed a household task I had been putting off.',
      'I contributed to making home a calm, orderly place.',
      'I neglected basic upkeep that I knew needed doing.',
    ],
  },
  {
    code: 'HORN',
    questions: [
      'I tried something challenging that could help me grow.',
      'I returned to an important goal after a setback.',
      'I acted on an important priority rather than only thinking about it.',
      'I knew what I was working towards.',
      'I avoided feedback that could have helped me improve.',
      'I broke a large goal into steps I could act on this week.',
      'I learned something new that supports a goal I care about.',
      'I measured progress on something important to me.',
      'I said no to distractions that would pull me off course.',
      'I gave up on a goal as soon as it got difficult.',
      'I asked for help or advice to improve in an area that matters to me.',
      'I finished something I started even when motivation dropped.',
      'I reviewed whether my daily actions matched my stated priorities.',
      'I took a small risk that could help me grow.',
      'I avoided trying because I feared I would not succeed.',
    ],
  },
  {
    code: 'HOOK',
    questions: [
      'I reduced avoidable distractions when I needed to concentrate.',
      'I made room for important personal, family, or work priorities before less important activities filled my time.',
      'I gave my attention to the person or activity in front of me.',
      'I planned my time so important things did not always get squeezed out.',
      'I became unnecessarily impatient when I had to wait.',
      'I started my day with a clear sense of what mattered most.',
      'I batch similar tasks to use my time more efficiently.',
      'I ended the day without leaving priorities I could have addressed undone.',
      'I protected focused time from unnecessary interruptions.',
      'I lost track of time on activities that did not matter to me.',
      'I arrived on time for commitments I had made.',
      'I built in buffer time so delays did not derail my whole day.',
      'I chose presence over multitasking when someone needed my attention.',
      'I reviewed how I spent my time and adjusted for the next day.',
      'I let urgent but unimportant tasks crowd out what truly mattered.',
    ],
  },
];

let order = 0;
const rows = [];
for (const hill of hills) {
  hill.questions.forEach((text, i) => {
    order += 1;
    rows.push({
      order,
      hillCode: hill.code,
      text,
      isReverseScored: (i + 1) % 5 === 0,
    });
  });
}

const lines = rows.map(
  (q) => `  {
    order: ${q.order},
    hillCode: '${q.hillCode}',
    text: ${JSON.stringify(q.text)},
    isReverseScored: ${q.isReverseScored},
  }`,
);

const content = `import type { HillCode } from '@prisma/client';

/** Official 105-question GAP instrument — 15 questions per hill, fixed order. */
export type Gap105QuestionSeed = {
  order: number;
  hillCode: HillCode;
  text: string;
  isReverseScored: boolean;
};

export const GAP_QUESTIONS_PER_HILL = 15;
export const GAP_105_QUESTIONS: Gap105QuestionSeed[] = [
${lines.join(',\n')},
];
`;

writeFileSync(join(__dirname, '../src/lib/gap105Questions.ts'), content);
console.log(`Wrote ${rows.length} questions to gap105Questions.ts`);
