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
    """Run optimization algorithm to match teachers and students."""
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

    # Optional per-field weights (importance)
    weights = {
        "subject_expertise": 1.2,
        "patience_level": 1.0,
        "innovation": 0.8,
        "structure": 0.8,
        "communication": 1.0,
        "special_needs_support": 1.5,
        "student_engagement": 1.0,
        "classroom_management": 1.0
    }

    for i, student in enumerate(students):
        for j, teacher in enumerate(teachers):
            score_sum, weight_sum = 0.0, 0.0

            # Direct relationships (higher teacher + higher student need = better)
            for field, weight in weights.items():
                student_key = _map_student_field(field)
                if student_key not in student:
                    continue  # skip missing fields

                t_val = float(teacher.get(field, 0))
                s_val = float(student.get(student_key, 0))

                # Normalized product
                pair_score = (t_val * s_val) / 10.0
                score_sum += pair_score * weight
                weight_sum += weight

            # Normalize score per teacher-student pair
            matrix[i, j] = score_sum / max(weight_sum, 1e-6)

    return matrix


def _map_student_field(teacher_field: str) -> str:
    """Map teacher fields to their corresponding student need fields."""
    mapping = {
        "subject_expertise": "subject_support_needed",
        "patience_level": "patience_needed",
        "innovation": "innovation_needed",
        "structure": "structure_needed",
        "communication": "communication_needed",
        "special_needs_support": "special_needs_support",
        "student_engagement": "engagement_needed",
        "classroom_management": "behavior_support_needed"
    }
    return mapping.get(teacher_field, teacher_field)


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
    student_indices, teacher_indices = linear_sum_assignment(-matrix)  # maximize compatibility

    assignments: Dict[str, List[str]] = {}
    for s_idx, t_idx in zip(student_indices, teacher_indices):
        t_id = teachers[t_idx]["teacher_id"]
        s_id = students[s_idx]["student_id"]
        assignments.setdefault(t_id, []).append(s_id)

    # Handle leftover students (if more students than teachers)
    assigned_students = {s for lst in assignments.values() for s in lst}
    unassigned_students = [s for s in students if s["student_id"] not in assigned_students]
    if unassigned_students:
        teacher_ids = list(assignments.keys())
        for i, student in enumerate(unassigned_students):
            target = teacher_ids[i % len(teacher_ids)]
            assignments[target].append(student["student_id"])

    return assignments


# ============================================================
# CLASS SIZE BALANCING
# ============================================================

def balance_class_sizes(assignments: Dict[str, List[str]], constraints: Dict[str, Any]) -> Dict[str, List[str]]:
    """Ensure each class stays within min/max constraints."""
    max_size = constraints.get("max_class_size", 25)
    min_size = constraints.get("min_class_size", 10)

    all_students = [s for subs in assignments.values() for s in subs]
    teacher_ids = list(assignments.keys())
    avg_size = len(all_students) // max(1, len(teacher_ids))

    new_assignments = {tid: [] for tid in teacher_ids}
    idx = 0
    for tid in teacher_ids:
        size = min(max_size, max(min_size, avg_size))
        new_assignments[tid] = all_students[idx:idx+size]
        idx += size

    # Add leftovers if any
    if idx < len(all_students):
        leftover = all_students[idx:]
        for i, sid in enumerate(leftover):
            new_assignments[teacher_ids[i % len(teacher_ids)]].append(sid)

    # Remove empty teacher slots
    return {k: v for k, v in new_assignments.items() if v}


# ============================================================
# LOCAL TEST
# ============================================================

def json_pretty(obj: Any) -> str:
    import json
    return json.dumps(obj, indent=2)


if __name__ == "__main__":
    teachers = [
        {"teacher_id": "Mr. David Chen", "subject_expertise": 10, "patience_level": 2,
         "innovation": 7, "structure": 9, "communication": 6, "special_needs_support": 1,
         "student_engagement": 5, "classroom_management": 8},
        {"teacher_id": "Ms. Amanda Tan", "subject_expertise": 9, "patience_level": 10,
         "innovation": 6, "structure": 9, "communication": 8, "special_needs_support": 10,
         "student_engagement": 7, "classroom_management": 8}
    ]

    students = [
        {"student_id": "Emily", "subject_support_needed": 9, "patience_needed": 8,
         "innovation_needed": 5, "structure_needed": 6, "communication_needed": 6,
         "special_needs_support": 2, "engagement_needed": 7, "behavior_support_needed": 4},
        {"student_id": "Marcus", "subject_support_needed": 3, "patience_needed": 10,
         "innovation_needed": 7, "structure_needed": 8, "communication_needed": 9,
         "special_needs_support": 8, "engagement_needed": 5, "behavior_support_needed": 3},
        {"student_id": "Aisha", "subject_support_needed": 8, "patience_needed": 9,
         "innovation_needed": 6, "structure_needed": 5, "communication_needed": 7,
         "special_needs_support": 10, "engagement_needed": 8, "behavior_support_needed": 6}
    ]

    matches = run_matching_algorithm(teachers, students, {"max_class_size": 2, "min_class_size": 1})
    print("\nFinal matches:\n", json_pretty(matches))
