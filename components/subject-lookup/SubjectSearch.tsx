'use client';

import { useState } from 'react';
import type { CourseMatch } from '@/lib/courses';

interface SubjectSearchProps {
  courses: CourseMatch[];
  onSelect: (course: CourseMatch) => void;
}

export function SubjectSearch({ courses, onSelect }: SubjectSearchProps) {
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);

  const q = query.trim().toLowerCase();
  const matches = q
    ? courses.filter(
        c =>
          c.shortName.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          c.fullName.toLowerCase().includes(q),
      )
    : [];

  function handleSelect(course: CourseMatch) {
    setQuery(`${course.code ? course.code + ' — ' : ''}${course.shortName}`);
    setShowResults(false);
    onSelect(course);
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        id="subjectSearchInput"
        className="input"
        type="text"
        autoComplete="off"
        placeholder="Type Short Name, Code, or Full Name…"
        value={query}
        onChange={e => {
          setQuery(e.target.value);
          setShowResults(true);
        }}
        onFocus={() => {
          if (query.trim()) setShowResults(true);
        }}
        onBlur={() => {
          setTimeout(() => setShowResults(false), 150);
        }}
      />
      {showResults && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 'calc(100% + 4px)',
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            maxHeight: '260px',
            overflowY: 'auto',
            zIndex: 20,
            boxShadow: 'var(--shadow)',
          }}
        >
          {matches.length === 0 ? (
            <div style={{ padding: '0.6rem 0.9rem', fontSize: '0.8rem', color: 'var(--muted)' }}>
              No matching course.
            </div>
          ) : (
            matches.map(c => (
              <div
                key={c.id}
                role="button"
                tabIndex={-1}
                onMouseDown={e => {
                  e.preventDefault();
                  handleSelect(c);
                }}
                style={{
                  padding: '0.55rem 0.9rem',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                  {c.code ? `${c.code} — ${c.shortName}` : c.shortName}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '2px' }}>
                  Semester {c.semester} · {c.fullName}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
