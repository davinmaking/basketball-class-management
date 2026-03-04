import { Tables } from "@/types/database";

type Student = Tables<"students">;

/**
 * Groups students by school_class.
 * Named classes come first (sorted), "未分班" group goes last.
 * Students within each group are sorted alphabetically.
 */
export function groupStudentsByClass<T extends Pick<Student, "school_class" | "name">>(
  students: T[]
): [string, T[]][] {
  const groups = new Map<string, T[]>();

  students.forEach((s) => {
    const key = s.school_class || "未分班";
    const group = groups.get(key) ?? [];
    group.push(s);
    groups.set(key, group);
  });

  const entries = Array.from(groups.entries()).sort((a, b) => {
    if (a[0] === "未分班") return 1;
    if (b[0] === "未分班") return -1;
    return a[0].localeCompare(b[0], "zh");
  });

  entries.forEach(([, group]) => {
    group.sort((a, b) => a.name.localeCompare(b.name, "zh"));
  });

  return entries;
}
