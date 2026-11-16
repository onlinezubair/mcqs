import type { ExamDefinition, ExamSet, Question, ExamConfig } from '@/types';

// The exam runs every set side by side, one question position at a time.
// With questionsPerSlide, each "slide" shows N questions per set.
// The run length is the longest set divided by questionsPerSlide (ceiling).
// Helpers here keep that arithmetic in one place.

export function getLockstepCount(exam: Pick<ExamDefinition, 'sets'>): number {
  return exam.sets.reduce((longest, set) => Math.max(longest, set.questionIds.length), 0);
}

export function getSlideCount(exam: Pick<ExamDefinition, 'sets'>, questionsPerSlide: number): number {
  const maxQuestions = exam.sets.reduce((longest, set) => Math.max(longest, set.questionIds.length), 0);
  return Math.ceil(maxQuestions / Math.max(1, questionsPerSlide));
}

export function getQuestionIdAtPosition(set: ExamSet, position: number): string | undefined {
  return set.questionIds[position];
}

export interface LockstepColumn {
  set: ExamSet;
  question: Question | undefined;
  options: [string, string, string, string] | undefined;
  /** 1-based number shown on the paper. */
  displayNumber: number;
}

export interface LockstepSlideColumn {
  set: ExamSet;
  questions: (Question | undefined)[];
  optionsList: ([string, string, string, string] | undefined)[];
  displayNumbers: number[];
}

// Resolves one slide into a column per set, with multiple questions per set.
// A set shorter than the run yields empty slots for missing questions.
export function getLockstepSlideColumns(
  exam: Pick<ExamDefinition, 'sets' | 'pool'>,
  slideIndex: number,
  questionsPerSlide: number,
): LockstepSlideColumn[] {
  const start = slideIndex * questionsPerSlide;
  const end = start + questionsPerSlide;

  return exam.sets.map(set => {
    const questions: (Question | undefined)[] = [];
    const optionsList: ([string, string, string, string] | undefined)[] = [];
    const displayNumbers: number[] = [];

    for (let position = start; position < end; position++) {
      const questionId = getQuestionIdAtPosition(set, position);
      const question = questionId ? exam.pool.find(q => q.id === questionId) : undefined;
      const perm = set.optionOrder?.[position];
      const options = question
        ? perm
          ? (question.options.map((_, i) => question.options[perm[i]!]) as [
              string,
              string,
              string,
              string,
            ])
          : question.options
        : undefined;

      questions.push(question);
      optionsList.push(options);
      displayNumbers.push(position + 1);
    }

    return { set, questions, optionsList, displayNumbers };
  });
}

// Resolves one position into a column per set, applying that set's option
// permutation. A set shorter than the run yields an empty column rather than
// borrowing a question from another position.
export function getLockstepColumns(
  exam: Pick<ExamDefinition, 'sets' | 'pool'>,
  position: number,
): LockstepColumn[] {
  return exam.sets.map(set => {
    const questionId = getQuestionIdAtPosition(set, position);
    const question = questionId ? exam.pool.find(q => q.id === questionId) : undefined;
    const perm = set.optionOrder?.[position];
    const options = question
      ? perm
        ? (question.options.map((_, i) => question.options[perm[i]!]) as [
            string,
            string,
            string,
            string,
          ])
        : question.options
      : undefined;

    return { set, question, options, displayNumber: position + 1 };
  });
}
