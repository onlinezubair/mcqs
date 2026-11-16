import type { ExamDefinition, Question, Issue, IssueCode } from '@/types';

interface MeasuredQuestion {
  question: Question;
  setLetter: string;
  index: number;
  height: number;
  maxHeight: number;
}

export async function getOverflowAudit(
  exam: ExamDefinition,
  fontScale: number,
  container: HTMLElement
): Promise<Issue[]> {
  const issues: Issue[] = [];
  const set = exam.sets[0];
  if (!set) return issues;

  const originalFontSize = document.documentElement.style.fontSize;
  document.documentElement.style.fontSize = `${fontScale * 16}px`;

  const probe = document.createElement('div');
  probe.style.cssText = `
    position: fixed;
    left: -9999px;
    top: -9999px;
    width: 1280px;
    height: 720px;
    font-family: inherit;
    font-size: 1rem;
    padding: 2rem;
    box-sizing: border-box;
    background: var(--bg);
    color: var(--fg);
    visibility: hidden;
  `;
  document.body.appendChild(probe);

  const slideHeight = 720 * 0.85;
  const questionMaxHeight = slideHeight * 0.7;
  const optionMaxHeight = slideHeight * 0.3;

  for (let i = 0; i < set.questionIds.length; i++) {
    const qid = set.questionIds[i];
    const q = exam.pool.find(p => p.id === qid);
    if (!q) continue;

    const perm = set.optionOrder?.[i];
    const opts = perm ? q.options.map((_, j) => q.options[perm[j]!]) : q.options;

    probe.innerHTML = `
      <div style="font-size: clamp(1.5rem, 4vw, 2.5rem); font-weight: 600; margin-bottom: 1rem;">
        Q${i + 1}. ${q.text}
      </div>
      <ol style="list-style: upper-alpha; padding-left: 1.5rem; font-size: clamp(1.125rem, 3vw, 1.5rem);">
        ${opts.map(opt => `<li style="margin-bottom: 0.5rem;">${opt}</li>`).join('')}
      </ol>
    `;

    const questionEl = probe.querySelector('div') as HTMLElement;
    const optionsEl = probe.querySelector('ol') as HTMLElement;

    const questionHeight = questionEl?.scrollHeight ?? 0;
    const optionsHeight = optionsEl?.scrollHeight ?? 0;

    if (questionHeight > questionMaxHeight) {
      issues.push({
        line: i + 1,
        severity: questionHeight > questionMaxHeight * 1.5 ? 'error' : 'warning',
        code: 'OVERFLOW_QUESTION' as IssueCode,
        message: `Question height ${questionHeight}px exceeds limit ${Math.round(questionMaxHeight)}px (${Math.round((questionHeight / questionMaxHeight - 1) * 100)}% over)`
      });
    }

    if (optionsHeight > optionMaxHeight) {
      issues.push({
        line: i + 1,
        severity: optionsHeight > optionMaxHeight * 1.5 ? 'error' : 'warning',
        code: 'OVERFLOW_OPTIONS' as IssueCode,
        message: `Options height ${optionsHeight}px exceeds limit ${Math.round(optionMaxHeight)}px (${Math.round((optionsHeight / optionMaxHeight - 1) * 100)}% over)`
      });
    }
  }

  document.body.removeChild(probe);
  document.documentElement.style.fontSize = originalFontSize;

  return issues;
}