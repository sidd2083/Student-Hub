/**
 * Converts a numeric grade to a human-readable label.
 *
 * Grades 9–12  → "Grade 9" … "Grade 12"
 * Grade 13     → "CEE"        (Medical entrance)
 * Grade 14     → "IOE"        (Engineering entrance)
 * Grade 15     → "Bachelor's"
 * Grade 0 / other → "Others"
 */
export function gradeLabel(grade: number): string {
  if (grade === 13) return "CEE";
  if (grade === 14) return "IOE";
  if (grade === 15) return "Bachelor's";
  if (grade === 0)  return "Others";
  return `Grade ${grade}`;
}
