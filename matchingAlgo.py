import numpy as np
from scipy.optimize import linear_sum_assignment
from typing import List, Dict, Any

# ============================================================
# MAIN MATCHING FUNCTION
# ============================================================

def run_matching_algorithm(
    teacher_profiles: List[Dict[str, Any]],
    student_profiles: List[Dict[str, Any]],
    constraints: Dict[str, Any]
) -> Dict[str, List[str]]:
    """
    Run optimization algorithm to match teachers and students
    based on their vector profiles.

    Parameters
    ----------
    teacher_profiles : list of dict
        Each teacher's numeric profile from teacherRadar.py
    student_profiles : list of dict
        Each student's numeric profile from studentRadar.py
    constraints : dict
        Optional settings such as max/min class size

    Returns
    -------
    dict
        Mapping {teacher_id: [student_id, ...]}
    """
    if not teacher_profiles or not student_profiles:
        print("[WARN] Empty teacher or student list. Returning empty match set.")
        return {}

    matrix = calculate_compatibility_matrix(teacher_profiles, student_profiles)
    assignments = assign_students(matrix, teacher_profiles, student_profiles)
    balanced = balance_class_sizes(assignments, constraints)
    return balanced


# ============================================================
# COMPATIBILITY MATRIX
# ============================================================

def calculate_compatibility_matrix(
    teachers: List[Dict[str, Any]],
    students: List[Dict[str, Any]]
) -> np.ndarray:
    """
    Calculate compatibility scores between every teacher-student pair.
    Returns a matrix of shape (num_students, num_teachers).
    """
    matrix = np.zeros((len(students), len(teachers)))

    for i, student in enumerate(students):
        for j, teacher in enumerate(teachers):
            compatibility = 0.0

            # Subject expertise vs support needed (inverse relationship)
            compatibility += (teacher["subject_expertise"] * (10 - student["subject_support_needed"])) / 10

            # Patience alignment
            compatibility += (teacher["patience_level"] * student["patience_needed"]) / 10

            # Innovation match
            compatibility += (teacher["innovation"] * student["innovation_needed"]) / 10

            # Structure match
            compatibility += (teacher["structure"] * student["structure_needed"]) / 10

            # Communication match
            compatibility += (teacher["communication"] * student["communication_needed"]) / 10

            # Special needs support (weighted higher)
            if student["special_needs_support"] > 5:
                compatibility += (teacher["special_needs_support"] * 2) / 10
            else:
                compatibility += (teacher["special_needs_support"] * student["special_needs_support"]) / 10

            # Engagement needs
            compatibility += (teacher["student_engagement"] * student["engagement_needed"]) / 10

            # Classroom management
            compatibility += (teacher["classroom_management"] * student["behavior_support_needed"]) / 10

            # Normalize across factors
            matrix[i, j] = compatibility / 8.0

    return matrix


# ============================================================
# OPTIMAL ASSIGNMENT
# ============================================================

def assign_students(
    matrix: np.ndarray,
    teachers: List[Dict[str, Any]],
    students: List[Dict[str, Any]]
) -> Dict[str, List[str]]:
    """
    Use Hungarian algorithm to assign students to teachers for max compatibility.
    """
    num_students, num_teachers = matrix.shape
    student_indices, teacher_indices = linear_sum_assignment(-matrix)  # maximize

    assignments: Dict[str, List[str]] = {}
    for s_idx, t_idx in zip(student_indices, teacher_indices):
        t_id = teachers[t_idx]["teacher_id"]
        s_id = students[s_idx]["student_id"]
        assignments.setdefault(t_id, []).append(s_id)

    # Handle unassigned students (if teacher count < student count)
    assigned_students = {s for lst in assignments.values() for s in lst}
    unassigned_students = [s for s in students if s["student_id"] not in assigned_students]

    if unassigned_students:
        print(f"[INFO] {len(unassigned_students)} unassigned students, distributing randomly.")
        teacher_ids = [t["teacher_id"] for t in teachers]
        for i, student in enumerate(unassigned_students):
            assigned_teacher = teacher_ids[i % len(teacher_ids)]
            assignments[assigned_teacher].append(student["student_id"])

    return assignments


# ============================================================
# CLASS SIZE BALANCING
# ============================================================

def balance_class_sizes(assignments: Dict[str, List[str]], constraints: Dict[str, Any]) -> Dict[str, List[str]]:
    """
    Enforce min/max class sizes by rebalancing students across teachers.
    Keeps random fairness while preserving overall match coverage.
    """
    max_size = constraints.get("max_class_size", 25)
    min_size = constraints.get("min_class_size", 10)

    all_students = [s for sub in assignments.values() for s in sub]
    teacher_ids = list(assignments.keys())
    avg_size = len(all_students) // max(1, len(teacher_ids))

    # redistribute to avoid overflows
    new_assignments = {tid: [] for tid in teacher_ids}
    idx = 0
    for tid in teacher_ids:
        size = min(max_size, max(min_size, avg_size))
        new_assignments[tid] = all_students[idx:idx+size]
        idx += size

    # catch any leftovers
    if idx < len(all_students):
        leftover = all_students[idx:]
        for i, sid in enumerate(leftover):
            target_teacher = teacher_ids[i % len(teacher_ids)]
            new_assignments[target_teacher].append(sid)

    # remove empty teachers if necessary
    new_assignments = {k: v for k, v in new_assignments.items() if v}

    return new_assignments


# ============================================================
# EXAMPLE LOCAL TEST
# ============================================================

def json_pretty(obj: Any) -> str:
    import json
    return json.dumps(obj, indent=2)

if __name__ == "__main__":
    teachers = [
        {"teacher_id": "T1", "subject_expertise": 8, "patience_level": 7, "innovation": 6,
         "structure": 8, "communication": 7, "special_needs_support": 6,
         "student_engagement": 7, "classroom_management": 8},
        {"teacher_id": "T2", "subject_expertise": 7, "patience_level": 9, "innovation": 8,
         "structure": 6, "communication": 9, "special_needs_support": 7,
         "student_engagement": 6, "classroom_management": 7}
    ]

    students = [
        {"student_id": "S1", "subject_support_needed": 5, "patience_needed": 8,
         "innovation_needed": 6, "structure_needed": 7, "communication_needed": 8,
         "special_needs_support": 2, "engagement_needed": 7, "behavior_support_needed": 4},
        {"student_id": "S2", "subject_support_needed": 3, "patience_needed": 6,
         "innovation_needed": 7, "structure_needed": 8, "communication_needed": 6,
         "special_needs_support": 4, "engagement_needed": 5, "behavior_support_needed": 3},
        {"student_id": "S3", "subject_support_needed": 8, "patience_needed": 9,
         "innovation_needed": 6, "structure_needed": 6, "communication_needed": 8,
         "special_needs_support": 7, "engagement_needed": 8, "behavior_support_needed": 6}
    ]

    matches = run_matching_algorithm(teachers, students, {"max_class_size": 2, "min_class_size": 1})
    print("\nFinal matches:\n", json_pretty(matches := matches))
