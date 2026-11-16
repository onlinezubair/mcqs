'use client';

import { escapeHtml } from '@/lib/escape';
import type { ExamDefinition } from '@/types';

interface PrintAreaProps {
  exam: ExamDefinition;
  mode: 'set' | 'paper' | 'answerKey';
  setIndex?: number;
}

export function PrintArea({ exam, mode, setIndex = 0 }: PrintAreaProps) {
  if (mode === 'set') {
    const set = exam.sets[setIndex];
    if (!set) return null;

    return (
      <div className="print-area">
        <h1>{exam.meta.examName}</h1>
        <div className="print-header">
          <p>{exam.meta.subject} — Set {set.letter}</p>
          <p>{exam.meta.date}</p>
        </div>
        <ol style={{ paddingLeft: '1.5rem' }}>
          {set.questionIds.map((qid, i) => {
            const q = exam.pool.find(p => p.id === qid);
            if (!q) return null;
            const perm = set.optionOrder?.[i];
            const opts = perm ? q.options.map((_, j) => q.options[perm[j]!]) : q.options;
            return (
              <li key={qid} className="print-question">
                <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                  {escapeHtml(q.label || `Q${i + 1}`)}
                  {q.groupStem ? ` — ${escapeHtml(q.groupStem)}` : ''}
                </p>
                <p style={{ marginBottom: '0.75rem' }}>{escapeHtml(q.text)}</p>
                <ol style={{ listStyle: 'upper-alpha', paddingLeft: '1.5rem' }}>
                  {opts.map((opt, j) => (
                    <li key={j} style={{ marginBottom: '0.25rem' }}>{escapeHtml(opt)}</li>
                  ))}
                </ol>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  if (mode === 'paper') {
    return (
      <div className="print-area">
        <h1>{exam.meta.examName}</h1>
        <div className="print-header">
          <p>{exam.meta.subject} — Sections B &amp; C</p>
          <p>{exam.meta.date}</p>
        </div>
        {(['sectionB', 'sectionC'] as const).map(key => (
          <section key={key} style={{ marginBottom: '2rem' }}>
            <h2>{key === 'sectionB' ? 'Section B' : 'Section C'}</h2>
            {exam[key].map(q => (
              <div key={q.number} className="print-question">
                <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                  Q{q.number}. {escapeHtml(q.text)}{q.marks ? ` [${q.marks} marks]` : ''}
                </p>
                <ol style={{ listStyle: 'lower-roman', paddingLeft: '1.5rem' }}>
                  {q.parts.map(p => (
                    <li key={p.label} style={{ marginBottom: '0.25rem' }}>
                      {escapeHtml(p.label)}. {escapeHtml(p.text)}{p.marks ? ` [${p.marks} marks]` : ''}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </section>
        ))}
      </div>
    );
  }

  if (mode === 'answerKey') {
    return (
      <div className="print-area">
        <h1>Answer Key — {exam.meta.examName}</h1>
        <div className="print-header">
          <p>{exam.meta.subject} — {exam.meta.date}</p>
        </div>
        {exam.sets.map(set => (
          <section key={set.letter} className="print-answer-key">
            <h2>Set {set.letter}</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #333' }}>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Q#</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Question ID</th>
                  <th style={{ textAlign: 'center', padding: '0.5rem' }}>Answer</th>
                </tr>
              </thead>
              <tbody>
                {set.questionIds.map((qid, i) => {
                  const q = exam.pool.find(p => p.id === qid);
                  if (!q || q.answer === undefined) return null;
                  const perm = set.optionOrder?.[i];
                  const permIdx = perm ? perm.indexOf(q.answer) : q.answer;
                  const answerLetter = permIdx >= 0 ? 'ABCD'[permIdx] : 'ABCD'[q.answer];
                  return (
                    <tr key={qid} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '0.5rem' }}>{i + 1}</td>
                      <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>{escapeHtml(qid)}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 600 }}>{answerLetter}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    );
  }

  return null;
}
