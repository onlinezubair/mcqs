'use client';

import { useEffect, useState } from 'react';
import { useExamStore } from '@/store/examStore';
import {
  findCourseByCode,
  findCourseById,
  findCourseBySubjectName,
  getCoursesForSemester,
  getPrograms,
  getSemesters,
  sortedByCode,
  type CourseMatch,
} from '@/lib/courses';
import { CloudAuthWidget } from '@/components/CloudAuthWidget/CloudAuthWidget';
import { useConfirm } from '@/components/ConfirmDialog/ConfirmDialog';
import { NumberInput } from '@/components/NumberInput/NumberInput';
import { EXAM_NAMES, SUBJECT_MODES } from '@/lib/validate';

const NO_SEMESTER = '';
const NO_SUBJECT = '';

export function MetaScreen() {
  const { draft, setMeta, transition } = useExamStore();
  const { confirm } = useConfirm();
  const [dateValue, setDateValue] = useState(draft.meta.date);
  const [codeInput, setCodeInput] = useState(draft.meta.subjectCode);
  const [selectedCourseId, setSelectedCourseId] = useState(NO_SUBJECT);

  const program = draft.meta.program;
  const examNameValue = EXAM_NAMES.includes(draft.meta.examName as (typeof EXAM_NAMES)[number])
    ? draft.meta.examName
    : EXAM_NAMES[0];
  const subjectModeValue = SUBJECT_MODES.includes(draft.meta.subjectMode as (typeof SUBJECT_MODES)[number])
    ? draft.meta.subjectMode
    : SUBJECT_MODES[0];
  const availablePrograms = Array.from(new Set([...getPrograms(), program].filter(Boolean)));
  const semesters = getSemesters();
  const semesterValue = semesterToOption(draft.meta.semester);
  const isPharmD = program === 'Pharm.D' || program === '';
  const semesterCourses = isPharmD ? sortedByCode(getCoursesForSemester(semesterValue)) : [];

  // Keep the Subject dropdown in sync with whatever is already in the store
  // (e.g. re-entering this screen, or a code fill) without clobbering a
  // deliberate blank choice while the teacher is editing.
  useEffect(() => {
    if (draft.meta.subject) {
      const match =
        findCourseByCode(draft.meta.subjectCode) ?? findCourseBySubjectName(draft.meta.subject);
      if (match) {
        setSelectedCourseId(match.id);
        return;
      }
    }
    setSelectedCourseId(NO_SUBJECT);
  }, []);

  const codeMatch = findCourseByCode(codeInput);
  const codeLooksEntered = codeInput.trim().length > 0;
  const codeUnknown = codeLooksEntered && codeMatch === null;

  const applyCourse = (course: CourseMatch) => {
    setMeta({
      program: 'Pharm.D',
      semester: String(course.semester),
      subject: course.shortName,
      subjectCode: course.code,
      subjectFullName: course.fullName,
    });
    setCodeInput(course.code);
    setSelectedCourseId(course.id);
  };

  const handleCodeChange = (value: string) => {
    setCodeInput(value);
    const match = findCourseByCode(value);
    if (match) applyCourse(match);
  };

  const handleCodeBlur = () => {
    if (!codeLooksEntered) return;
    const match = findCourseByCode(codeInput);
    if (match) applyCourse(match);
  };

  const handleSemesterChange = (value: string) => {
    setCodeInput('');
    setSelectedCourseId(NO_SUBJECT);
    setMeta({ semester: value, subjectCode: '', subject: '', subjectFullName: '' });
  };

  const handleSubjectChange = (id: string) => {
    setSelectedCourseId(id);
    if (id === NO_SUBJECT) {
      setCodeInput('');
      setMeta({ subject: '', subjectCode: '', subjectFullName: '' });
      return;
    }
    const course = findCourseById(id);
    if (course) applyCourse(course);
  };

  const handleContinue = () => {
    if (!draft.meta.subject.trim() || !draft.meta.examName.trim() || draft.meta.quizNumber < 0) {
      confirm('Please fill in all required fields: Subject and Exam Name are required.', () => {});
      return;
    }
    transition('setup');
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', paddingTop: '3rem' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>MCQ Projector</h1>
      <p style={{ textAlign: 'center', color: 'var(--muted)', marginBottom: '2rem' }}>
        Configure exam metadata
      </p>

      <CloudAuthWidget />

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 className="mb-4">Exam Metadata</h2>

        <div className="mb-4">
          <label className="label" htmlFor="metaSubjectCode">
            Subject Code
          </label>
          <input
            id="metaSubjectCode"
            className="input"
            value={codeInput}
            onChange={e => handleCodeChange(e.target.value)}
            onBlur={handleCodeBlur}
            placeholder="e.g., 310 — fills semester and subject automatically"
            autoComplete="off"
          />
          {codeMatch && (
            <p className="help-text mt-2" style={{ color: 'var(--success)' }}>
              {codeMatch.code} · Semester {codeMatch.semester} · {codeMatch.shortName}
            </p>
          )}
          {codeUnknown && (
            <p className="help-text mt-2" style={{ color: 'var(--warning)' }}>
              Code not recognised — choose Semester and Subject below instead.
            </p>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '1rem',
          }}
        >
          <div className="mb-4">
            <label className="label" htmlFor="metaProgram">
              Program
            </label>
            <select
              id="metaProgram"
              className="input"
              value={program}
              onChange={e => {
                setMeta({ program: e.target.value });
                setCodeInput('');
                setSelectedCourseId(NO_SUBJECT);
              }}
            >
              {availablePrograms.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="label" htmlFor="metaSemester">
              Semester
            </label>
            <select
              id="metaSemester"
              className="input"
              value={semesterValue}
              onChange={e => handleSemesterChange(e.target.value)}
              disabled={!isPharmD}
            >
              <option value={NO_SEMESTER}>— select —</option>
              {semesters.map(semester => (
                <option key={semester} value={String(semester)}>
                  Semester {semester}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="label" htmlFor="metaSubject">
              Subject *
            </label>
            <select
              id="metaSubject"
              className="input"
              value={selectedCourseId}
              onChange={e => handleSubjectChange(e.target.value)}
              disabled={!isPharmD || semesterCourses.length === 0}
            >
              <option value={NO_SUBJECT}>
                {semesterValue === NO_SEMESTER ? '— select semester first —' : '— select subject —'}
              </option>
              {semesterCourses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.code ? `${course.code} — ${course.shortName}` : course.shortName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {draft.meta.subjectFullName && (
          <p className="help-text mb-4">{draft.meta.subjectFullName}</p>
        )}

        {!isPharmD && (
          <div className="mb-4">
            <label className="label">Subject *</label>
            <input
              className="input"
              value={draft.meta.subject}
              onChange={e => setMeta({ subject: e.target.value })}
              placeholder="No bundled list for this program — type the subject"
            />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="mb-4">
            <label className="label" htmlFor="metaExamName">
              Exam Name *
            </label>
            <select
              id="metaExamName"
              className="input"
              value={examNameValue}
              onChange={e => setMeta({ examName: e.target.value })}
            >
              {EXAM_NAMES.map(name => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <label className="label" htmlFor="metaSubjectMode">
              Subject Mode
            </label>
            <select
              id="metaSubjectMode"
              className="input"
              value={subjectModeValue}
              onChange={e => setMeta({ subjectMode: e.target.value })}
            >
              {SUBJECT_MODES.map(mode => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {examNameValue === 'Quiz' && (
            <div className="mb-4">
              <label className="label">Quiz Number</label>
              <NumberInput
                className="input"
                min={1}
                value={draft.meta.quizNumber}
                onChange={quizNumber => setMeta({ quizNumber })}
              />
            </div>
          )}
          <div className="mb-4">
            <label className="label">Date</label>
            <input
              className="input"
              type="date"
              value={dateValue}
              onChange={e => {
                setDateValue(e.target.value);
                setMeta({ date: e.target.value, dateManuallySet: true });
              }}
            />
          </div>
        </div>

        <details>
          <summary style={{ cursor: 'pointer', color: 'var(--muted)', fontSize: '0.85rem' }}>
            Edit derived fields manually
          </summary>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
            <div>
              <label className="label">Subject Code</label>
              <input
                className="input"
                value={draft.meta.subjectCode}
                onChange={e => setMeta({ subjectCode: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Subject Full Name</label>
              <input
                className="input"
                value={draft.meta.subjectFullName}
                onChange={e => setMeta({ subjectFullName: e.target.value })}
              />
            </div>
          </div>
        </details>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
        <button className="btn btn-primary" onClick={handleContinue} style={{ minWidth: '160px' }}>
          Continue →
          <span className="kbd-hint"><kbd>Enter</kbd></span>
        </button>
      </div>
    </div>
  );
}

function semesterToOption(value: string): string {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? String(parsed) : NO_SEMESTER;
}
