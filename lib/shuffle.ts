import type { Question, ExamConfig, ExamSet, OptionPermutation, Letter } from '@/types';
import { createRng, shuffleInPlace } from './rng';

const DEPENDENT_PATTERNS = [
  /all of the above/i,
  /none of the above/i,
  /both .+ and .+/i,
  /either .+ or .+/i,
  /neither .+ nor .+/i,
  /all of these/i,
  /none of these/i,
];

function hasDependentOption(options: [string, string, string, string]): boolean {
  return options.some(opt => DEPENDENT_PATTERNS.some(p => p.test(opt.trim())));
}

function generatePermutation(rng: () => number): OptionPermutation {
  const indices: Letter[] = [0, 1, 2, 3];
  return shuffleInPlace([...indices], rng) as OptionPermutation;
}

function applyPermutation(options: [string, string, string, string], perm: OptionPermutation): [string, string, string, string] {
  return [
    options[perm[0]]!,
    options[perm[1]]!,
    options[perm[2]]!,
    options[perm[3]]!,
  ];
}

function remapAnswer(answer: Letter, perm: OptionPermutation): Letter {
  return perm.indexOf(answer) as Letter;
}

function answerDistribution(questions: Question[], answerIndex: number): number {
  return questions.filter(q => q.answer === answerIndex).length;
}

export function buildSets(pool: Question[], config: ExamConfig): ExamSet[] {
  const sets: ExamSet[] = [];
  const setCount = config.numSets;
  const strategy = config.setStrategy;
  const shuffleOpts = config.shuffleOptions;

  const baseSeed = config.seed;

  if (strategy === 'reorderAll') {
    const poolIndices = pool.map((_, i) => i);

    for (let s = 0; s < setCount; s++) {
      const setSeed = `${baseSeed}|${String.fromCharCode(65 + s)}`;
      const rng = createRng(setSeed);

      const shuffled = shuffleInPlace([...poolIndices], rng);

      let optionOrder: OptionPermutation[] | undefined;
      if (shuffleOpts) {
        optionOrder = shuffled.map((poolIdx) => {
          const q = pool[poolIdx]!;
          if (hasDependentOption(q.options)) {
            return [0, 1, 2, 3] as OptionPermutation;
          }
          return generatePermutation(rng);
        });
      }

      sets.push({
        letter: String.fromCharCode(65 + s),
        questionIds: shuffled.map(i => pool[i]!.id),
        optionOrder,
      });
    }

    for (let attempt = 0; attempt < 10 && setCount >= 2; attempt++) {
      let collision = false;
      for (let i = 0; i < setCount - 1; i++) {
        for (let j = i + 1; j < setCount; j++) {
          const setI = sets[i];
          const setJ = sets[j];
          if (!setI || !setJ) continue;
          for (let k = 0; k < setI.questionIds.length; k++) {
            if (setI.questionIds[k] === setJ.questionIds[k]) {
              collision = true;
              break;
            }
          }
          if (collision) break;
        }
        if (collision) break;
      }
      if (!collision) break;

      for (let s = 0; s < setCount; s++) {
        const setSeed = `${baseSeed}|${String.fromCharCode(65 + s)}|retry${attempt}`;
        const rng = createRng(setSeed);
        const poolIndices = pool.map((_, i) => i);
        const shuffled = shuffleInPlace([...poolIndices], rng);
        const currentSet = sets[s];
        if (currentSet) {
          currentSet.questionIds = shuffled.map(i => pool[i]!.id);
          if (shuffleOpts) {
            currentSet.optionOrder = shuffled.map((poolIdx) => {
              const q = pool[poolIdx]!;
              if (hasDependentOption(q.options)) {
                return [0, 1, 2, 3] as OptionPermutation;
              }
              return generatePermutation(rng);
            });
          }
        }
      }
    }
  } else {
    for (let s = 0; s < setCount; s++) {
      const setSeed = `${baseSeed}|${String.fromCharCode(65 + s)}`;
      const rng = createRng(setSeed);

      const poolIndices = pool.map((_, i) => i);
      const shuffled = shuffleInPlace([...poolIndices], rng);
      const selected = shuffled.slice(0, config.questionsPerSet);

      let optionOrder: OptionPermutation[] | undefined;
      if (shuffleOpts) {
        optionOrder = selected.map((idx) => {
          const q = pool[idx]!;
          if (hasDependentOption(q.options)) {
            return [0, 1, 2, 3] as OptionPermutation;
          }
          return generatePermutation(rng);
        });
      }

      sets.push({
        letter: String.fromCharCode(65 + s),
        questionIds: selected.map(i => pool[i]!.id),
        optionOrder,
      });
    }
  }

  return sets;
}

export function getSetAnswerDistribution(set: ExamSet, pool: Question[]): Record<string, number> {
  const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  set.questionIds.forEach((id, i) => {
    const q = pool.find(p => p.id === id);
    if (!q) return;
    const perm = set.optionOrder?.[i];
    const displayIdx = perm ? perm.indexOf(q.answer) : q.answer;
    const letter = 'ABCD'[displayIdx];
    if (letter) dist[letter] = (dist[letter] ?? 0) + 1;
  });
  return dist;
}