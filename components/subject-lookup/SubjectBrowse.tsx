'use client';

import type { CourseMatch } from '@/lib/courses';
import { sortedByCode, sortedByShortName } from '@/lib/courses';

interface SubjectBrowseProps {
  courses: CourseMatch[];
  selected: CourseMatch | null;
  onSelect: (course: CourseMatch) => void;
}

const sublabelStyle = {
  display: 'block',
  fontSize: '0.7rem',
  fontWeight: 700,
  color: 'var(--muted)',
  marginBottom: '0.3rem',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
} as const;

export function SubjectBrowse({ courses, selected, onSelect }: SubjectBrowseProps) {
  const byShortName = sortedByShortName(courses);
  const byCode = sortedByCode(courses);

  function handleChange(id: string) {
    const course = courses.find(c => c.id === id);
    if (course) onSelect(course);
  }

  return (
    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
      <div style={{ flex: '2.6', minWidth: '200px' }}>
        <label style={sublabelStyle} htmlFor="subjectShortSelect">
          Course Short Name
        </label>
        <select
          id="subjectShortSelect"
          className="input"
          value={selected?.id ?? ''}
          onChange={e => handleChange(e.target.value)}
        >
          {byShortName.map(c => (
            <option key={c.id} value={c.id}>
              {c.shortName}
            </option>
          ))}
        </select>
      </div>
      <div style={{ flex: '1', minWidth: '140px' }}>
        <label style={sublabelStyle} htmlFor="subjectCodeSelect">
          Course Code
        </label>
        <select
          id="subjectCodeSelect"
          className="input"
          value={selected?.id ?? ''}
          onChange={e => handleChange(e.target.value)}
        >
          {byCode.map(c => (
            <option key={c.id} value={c.id}>
              {c.codeDisplay}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
