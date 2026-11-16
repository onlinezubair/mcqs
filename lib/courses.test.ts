import { describe, it, expect } from 'vitest';
import {
  RAW_COURSES,
  defaultCourseForSemester,
  findCourseByCode,
  findCourseById,
  findCourseBySubjectName,
  getCoursesForSemester,
  getSemesters,
  sortedByCode,
  sortedByShortName,
} from './courses';

describe('bundled course data', () => {
  it('contains the rows from PharmD_Course_Codes.csv', () => {
    expect(RAW_COURSES).toHaveLength(58);
    expect(getSemesters()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('has no duplicate non-empty codes', () => {
    const codes = RAW_COURSES.map(c => c.code).filter(Boolean);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('findCourseByCode', () => {
  it('resolves a bare code', () => {
    expect(findCourseByCode('310')?.shortName).toBe('Physical Pharmacy-I');
  });

  it('tolerates whitespace, case and PHARM prefixes', () => {
    expect(findCourseByCode('  310  ')?.code).toBe('310');
    expect(findCourseByCode('pharm 310')?.code).toBe('310');
    expect(findCourseByCode('PHARM-612')?.code).toBe('612');
  });

  it('returns null for blank or unknown codes', () => {
    expect(findCourseByCode('')).toBeNull();
    expect(findCourseByCode('999')).toBeNull();
    expect(findCourseByCode('abc')).toBeNull();
  });
});

describe('findCourseBySubjectName', () => {
  it('matches short and full names', () => {
    expect(findCourseBySubjectName('Physical Pharmacy-I')?.code).toBe('310');
    expect(findCourseBySubjectName('pharmaceutics-ia: physical pharmacy i')?.code).toBe('310');
  });

  it('returns null for an unknown name', () => {
    expect(findCourseBySubjectName('Underwater Basket Weaving')).toBeNull();
  });
});

describe('semester browsing', () => {
  it('returns only that semester\'s courses', () => {
    const courses = getCoursesForSemester(4);
    expect(courses.length).toBeGreaterThan(0);
    expect(courses.every(c => c.semester === 4)).toBe(true);
  });

  it('returns an empty list for an unknown semester', () => {
    expect(getCoursesForSemester(99)).toEqual([]);
    expect(getCoursesForSemester('')).toEqual([]);
  });

  it('exposes unique ids findable again', () => {
    for (const course of getCoursesForSemester(1)) {
      expect(findCourseById(course.id)?.code).toBe(course.code);
    }
  });

  it('sorts by code then by short name', () => {
    const sorted = sortedByCode(getCoursesForSemester(5));
    expect(sorted[0]?.code).toBe('414');
    const byName = sortedByShortName(getCoursesForSemester(5)).map(c => c.shortName);
    expect(byName).toEqual([...byName].sort((a, b) => a.localeCompare(b)));
  });

  it('picks the lowest-code course as the default', () => {
    expect(defaultCourseForSemester(3)?.code).toBe('410');
    expect(defaultCourseForSemester(99)).toBeNull();
  });
});
