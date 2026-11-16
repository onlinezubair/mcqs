// Bundled PharmD course list, sourced from PharmD_Course_Codes.csv at the
// project root. This is the authoritative subject metadata: a code is a
// direct lookup key, and semester -> subject is the hierarchical fallback
// when a teacher does not know/enter the code.
//
// Codes are intentionally strings ("310", not 310) because some rows have no
// code at all and the leading zero would matter for other programs.

export interface Course {
  semester: number;
  code: string;
  shortName: string;
  fullName: string;
}

export interface CourseMatch extends Course {
  id: string;
  codeDisplay: string;
}

export const RAW_COURSES: Course[] = [
  { semester: 1, code: '310', shortName: 'Physical Pharmacy-I', fullName: 'Pharmaceutics-IA: Physical Pharmacy I' },
  { semester: 1, code: '311', shortName: 'Organic Chemistry-I', fullName: 'Pharmaceutical Chemistry IA (Organic Chemistry I)' },
  { semester: 1, code: '312', shortName: 'Biochemistry-I', fullName: 'Pharmaceutical Chemistry IIA (Biochemistry-I)' },
  { semester: 1, code: '313', shortName: 'Physiology-I', fullName: 'Physiology-I' },
  { semester: 1, code: '300', shortName: 'Functional English', fullName: 'Functional English' },
  { semester: 2, code: '315', shortName: 'Physical Pharmacy-II', fullName: 'Pharmaceutics-IB: Physical Pharmacy II' },
  { semester: 2, code: '316', shortName: 'Organic Chemistry-II', fullName: 'Pharmaceutical Chemistry IB (Organic Chemistry-II)' },
  { semester: 2, code: '317', shortName: 'Biochemistry-II', fullName: 'Pharmaceutical Chemistry IIB (Biochemistry-II)' },
  { semester: 2, code: '314', shortName: 'Anatomy & Histology', fullName: 'Anatomy & Histology' },
  { semester: 2, code: '318', shortName: 'Physiology-II', fullName: 'Physiology-II' },
  { semester: 2, code: '402', shortName: 'Islamic Studies', fullName: 'Islamic Studies' },
  { semester: 3, code: '410', shortName: 'DDSFS-I', fullName: 'Pharmaceutics-IIA: Drug Delivery Systems and Formulation Science-I' },
  { semester: 3, code: '412', shortName: 'Pharmacology & Therapeutics-I', fullName: 'Pharmacology & Therapeutics-1A' },
  { semester: 3, code: '413', shortName: 'Pharmacognosy (Basic I)', fullName: 'Pharmacognosy-IA (Basic-I)' },
  { semester: 3, code: '514', shortName: 'Pathology', fullName: 'Pathology' },
  { semester: 3, code: '411', shortName: 'Basic Pharmaceutical Microbiology', fullName: 'Pharmaceutics-IIIA: Pharmaceutical Microbiology I' },
  { semester: 4, code: '415', shortName: 'DDSFS-II', fullName: 'Pharmaceutics IIB: Drug Delivery Systems and Formulation Science II' },
  { semester: 4, code: '416', shortName: 'Applied Pharmaceutical Microbiology & Immunology', fullName: 'Pharmaceutics-IIIB: Pharmaceutical Microbiology-II: Applied Pharmaceutical Microbiology and Immunology' },
  { semester: 4, code: '417', shortName: 'AI in Pharmacology & Therapeutics', fullName: 'Pharmacology & Therapeutics-IB (scheme title: Artificial Intelligence in Pharmacology and Therapeutics, Pharmacology and Therapeutics-II)' },
  { semester: 4, code: '418', shortName: 'Pharmacognosy (Basic II)', fullName: 'Pharmacognosy-IB (Basic-II)' },
  { semester: 4, code: '403', shortName: 'Pakistan Studies', fullName: 'Pakistan Studies' },
  { semester: 4, code: '', shortName: 'Fehm-e-Quran I', fullName: 'Fehm-e-Quran I' },
  { semester: 5, code: '513', shortName: 'Pharmacognosy (Applied)', fullName: 'Pharmacognosy-IIA (Applied)' },
  { semester: 5, code: '511', shortName: 'Pharmaceutical Analysis-I', fullName: 'Pharmaceutical Chemistry IIIA: Pharmaceutical Analysis I' },
  { semester: 5, code: '512', shortName: 'Pharmacology & Therapeutics-III', fullName: 'Pharmacology & Therapeutics-IIA' },
  { semester: 5, code: '', shortName: 'Hospital & Community Pharmacy', fullName: 'Pharmacy Practice-IA: Social and Administrative Pharmacy (Hospital and Community Pharmacy)' },
  { semester: 5, code: '414', shortName: 'Quantitative Reasoning-I', fullName: 'Quantitative Reasoning – I' },
  { semester: 5, code: '', shortName: 'Ideology & Constitution of Pakistan', fullName: 'Ideology & Constitution of Pakistan' },
  { semester: 5, code: '', shortName: 'Fehm-e-Quran II', fullName: 'Fehm-e-Quran II' },
  { semester: 6, code: '518', shortName: 'Pharmacognosy (Advanced)', fullName: 'Pharmacognosy-IIB (Advanced)' },
  { semester: 6, code: '', shortName: 'Dispensing, Social & Administrative Pharmacy', fullName: 'Pharmacy Practice-IB: Social and Administrative Pharmacy (Dispensing Social and Administrative Pharmacy)' },
  { semester: 6, code: '516', shortName: 'Pharmaceutical Analysis-II', fullName: 'Pharmaceutical Chemistry IIIB: Pharmaceutical Analysis II' },
  { semester: 6, code: '517', shortName: 'Pharmacology & Therapeutics-IV', fullName: 'Pharmacology & Therapeutics-IIB' },
  { semester: 6, code: '519', shortName: 'Applications of ICT', fullName: 'Applications of ICT (Special Focus on Pharmacy)' },
  { semester: 6, code: '419', shortName: 'Quantitative Reasoning-II', fullName: 'Quantitative Reasoning – II (Biostatistics content)' },
  { semester: 7, code: '612', shortName: 'Industrial Pharmacy-I', fullName: 'Pharmaceutics-IVA: Industrial Pharmacy I' },
  { semester: 7, code: '613', shortName: 'Biopharmaceutics & Pharmacokinetics-I', fullName: 'Pharmaceutics-VA: Biopharmaceutics and Pharmacokinetics-I' },
  { semester: 7, code: '611', shortName: 'Clinical Pharmacy-I', fullName: 'Pharmacy Practice-IIA (Clinical Pharmacy-I)' },
  { semester: 7, code: '614', shortName: 'Pharmaceutical QMS', fullName: 'Pharmaceutics-VI: Pharmaceutical Quality Management Systems' },
  { semester: 7, code: '301', shortName: 'Expository Writing', fullName: 'Expository Writing' },
  { semester: 7, code: '', shortName: 'Entrepreneurship', fullName: 'Entrepreneurship' },
  { semester: 8, code: '617', shortName: 'Industrial Pharmacy-II', fullName: 'Pharmaceutics-IVB: Industrial Pharmacy-II' },
  { semester: 8, code: '618', shortName: 'Biopharmaceutics & Pharmacokinetics-II', fullName: 'Pharmaceutics-VA (printed as VA, likely VB): Biopharmaceutics and Pharmacokinetics-II' },
  { semester: 8, code: '616', shortName: 'Clinical Pharmacy-II', fullName: 'Pharmacy Practice-IIB (Clinical Pharmacy-II)' },
  { semester: 8, code: '', shortName: 'Civics & Community Engagement', fullName: 'Pharmacy Practice-III: Civics and Community Engagement' },
  { semester: 8, code: '619', shortName: 'Pharmaceutical Quality Control', fullName: 'Pharmaceutical Chemistry IV: Pharmaceutical Quality Control' },
  { semester: 8, code: '', shortName: 'Pharmaceutical Management & Marketing', fullName: 'Pharmacy Practice-IV: Pharmaceutical Management and Marketing' },
  { semester: 9, code: '710', shortName: 'Pharmaceutical Technology-I', fullName: 'Pharmaceutics-VIIA: Pharmaceutical Technology I' },
  { semester: 9, code: '712', shortName: 'Pharmaceutical Regulatory Science-I', fullName: 'Pharmacy Practice-VA: Pharmaceutical Regulatory Sciences-I' },
  { semester: 9, code: '714', shortName: 'Medicinal Chemistry-I', fullName: 'Pharmaceutical Chemistry VA: Medicinal Chemistry I' },
  { semester: 9, code: '711', shortName: 'Advanced Clinical Pharmacy-I', fullName: 'Pharmacy Practice-VIA: Advanced Clinical Pharmacy-I' },
  { semester: 9, code: '', shortName: 'Clinical Pharmacology', fullName: 'Clinical Pharmacology' },
  { semester: 10, code: '715', shortName: 'Pharmaceutical Technology-II', fullName: 'Pharmaceutics-VIIB: Pharmaceutical Technology II' },
  { semester: 10, code: '717', shortName: 'Pharmaceutical Regulatory Science-II', fullName: 'Pharmacy Practice-VB: Pharmaceutical Regulatory Sciences-II' },
  { semester: 10, code: '719', shortName: 'Medicinal Chemistry-II', fullName: 'Pharmaceutical Chemistry VB: Medicinal Chemistry-II' },
  { semester: 10, code: '716', shortName: 'Advanced Clinical Pharmacy-II', fullName: 'Pharmacy Practice-VIB: Advanced Clinical Pharmacy-II' },
  { semester: 10, code: '', shortName: 'Bioethics', fullName: 'Bioethics' },
  { semester: 10, code: '', shortName: 'Capstone Project', fullName: 'Capstone Project' },
];


const DEFAULT_PROGRAM = 'Pharm.D';

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Build the derived id / codeDisplay once at module load.
const INDEXED: CourseMatch[] = RAW_COURSES.map((course, index) => ({
  ...course,
  id: `c${index}`,
  codeDisplay: course.code ? course.code : course.shortName,
}));

export const SEMESTERS: number[] = Array.from(new Set(RAW_COURSES.map(c => c.semester))).sort(
  (a, b) => a - b,
);

export function getSemesters(): number[] {
  return SEMESTERS;
}

export function getCoursesForSemester(semester: number | string): CourseMatch[] {
  const semesterNumber = typeof semester === 'string' ? Number.parseInt(semester, 10) : semester;
  if (!Number.isFinite(semesterNumber)) return [];
  return INDEXED.filter(course => course.semester === semesterNumber);
}

export function getPrograms(): string[] {
  return [DEFAULT_PROGRAM];
}

// Direct Subject Code lookup: "310", "PHARM 310", " 310 " and "pharm-310"
// all resolve to the same course. Returns null for unknown or blank codes.
export function findCourseByCode(code: string): CourseMatch | null {
  const cleaned = normalize(code).replace(/[^a-z0-9]/g, '');
  if (!cleaned) return null;

  const exact = INDEXED.find(course => {
    const courseCode = course.code.replace(/[^a-z0-9]/g, '');
    return courseCode !== '' && courseCode === cleaned;
  });
  if (exact) return exact;

  // Tolerate "PHARM310" style prefixes against bare numeric codes.
  const numeric = cleaned.replace(/[^0-9]/g, '');
  if (!numeric) return null;
  return (
    INDEXED.find(course => course.code !== '' && course.code.replace(/[^0-9]/g, '') === numeric) ?? null
  );
}

export function findCourseBySubjectName(name: string): CourseMatch | null {
  const cleaned = normalize(name);
  if (!cleaned) return null;
  return (
    INDEXED.find(
      course => normalize(course.shortName) === cleaned || normalize(course.fullName) === cleaned,
    ) ?? null
  );
}

export function findCourseById(id: string): CourseMatch | null {
  return INDEXED.find(course => course.id === id) ?? null;
}

function digitsOf(code: string): number {
  const digits = code.replace(/\D/g, '');
  return digits ? Number.parseInt(digits, 10) : Number.MAX_SAFE_INTEGER;
}

export function sortedByShortName<T extends Course>(courses: T[]): T[] {
  return courses.slice().sort((a, b) => a.shortName.localeCompare(b.shortName));
}

export function sortedByCode<T extends Course>(courses: T[]): T[] {
  return courses.slice().sort((a, b) => {
    const diff = digitsOf(a.code) - digitsOf(b.code);
    return diff !== 0 ? diff : a.shortName.localeCompare(b.shortName);
  });
}

export function defaultCourseForSemester(semester: number | string): CourseMatch | null {
  return sortedByCode(getCoursesForSemester(semester))[0] ?? null;
}
