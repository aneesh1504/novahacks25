import numpy as np
from scipy.optimize import linear_sum_assignment
from typing import List, Dict, Any
from sklearn.metrics.pairwise import cosine_similarity


# ============================================================
# MAIN MATCHING PIPELINE
# ============================================================

def run_matching_algorithm(
    teacher_profiles: List[Dict[str, Any]],
    student_profiles: List[Dict[str, Any]],
    constraints: Dict[str, Any]
) -> Dict[str, List[str]]:
    """Optimized teacher–student matching using adaptive weighting and semantic similarity."""
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
    Calculate compatibility between each teacher–student pair.
    Uses weighted cosine similarity + semantic alignment if available.
    """
    matrix = np.zeros((len(students), len(teachers)))

    field_map = {
        "subject_expertise": "subject_support_needed",
        "patience_level": "patience_needed",
        "innovation": "innovation_needed",
        "structure": "structure_needed",
        "communication": "communication_needed",
        "special_needs_support": "special_needs_support",
        "student_engagement": "engagement_needed",
        "classroom_management": "behavior_support_needed"
    }

    base_weights = {
        "subject_expertise": 1.2,
        "patience_level": 1.2,
        "innovation": 0.9,
        "structure": 1.0,
        "communication": 1.1,
        "special_needs_support": 1.5,
        "student_engagement": 1.0,
        "classroom_management": 1.0
    }

    for i, student in enumerate(students):
        for j, teacher in enumerate(teachers):
            # --- Build weighted numeric vectors ---
            t_vec, s_vec, w_vec = [], [], []
            for t_field, s_field in field_map.items():
                t_val = float(teacher.get(t_field, 0))
                s_val = float(student.get(s_field, 0))
                weight = base_weights[t_field]

                # Adaptive weighting: emphasize needs
                if s_val > 7:
                    weight *= 1.25
                if student.get("confidence_level", 5) < 5 and t_field in ["patience_level", "structure"]:
                    weight *= 1.2

                t_vec.append(t_val)
                s_vec.append(s_val)
                w_vec.append(weight)

            t_vec, s_vec, w_vec = np.array(t_vec), np.array(s_vec), np.array(w_vec)

            # --- Weighted cosine similarity ---
            num = np.sum(w_vec * t_vec * s_vec)
            denom = np.sqrt(np.sum(w_vec * t_vec**2)) * np.sqrt(np.sum(w_vec * s_vec**2))
            cosine_score = num / denom if denom > 0 else 0

            # --- Penalty for mismatched fields ---
            diff_penalty = np.mean(np.abs(t_vec - s_vec)) / 10  # 0–1 scale
            combined_score = (cosine_score - diff_penalty)

            # --- Rescale (-1,1) → (0,10) ---
            combined_score = max(0, min(10, (combined_score + 1) * 5))

            # --- Bonus for strong overlaps ---
            high_need_bonus = np.mean([(t * s) / 10 for t, s in zip(t_vec, s_vec) if s > 7]) * 0.4
            combined_score = min(10, combined_score + high_need_bonus)

            # --- Optional: semantic similarity ---
            semantic_weight = 0.2
            if "teacher_archetype" in teacher and "best_teacher_profile" in student:
                semantic_score = _semantic_similarity(
                    teacher["teacher_archetype"], student["best_teacher_profile"]
                ) * 10  # scale to 0–10
                combined_score = 0.8 * combined_score + semantic_weight * semantic_score

            matrix[i, j] = round(combined_score, 3)

    return matrix


def _semantic_similarity(a: str, b: str) -> float:
    """Lightweight cosine similarity for text (no external embeddings)."""
    # Convert to word vectors (bag-of-words cosine)
    a_words, b_words = set(a.lower().split()), set(b.lower().split())
    common = len(a_words.intersection(b_words))
    denom = np.sqrt(len(a_words) * len(b_words))
    return common / denom if denom > 0 else 0.0


# ============================================================
# OPTIMAL ASSIGNMENT
# ============================================================

def assign_students(
    matrix: np.ndarray,
    teachers: List[Dict[str, Any]],
    students: List[Dict[str, Any]]
) -> Dict[str, List[str]]:
    """Assign students optimally using Hungarian algorithm."""
    student_idx, teacher_idx = linear_sum_assignment(-matrix)
    assignments: Dict[str, List[str]] = {}

    for s_i, t_i in zip(student_idx, teacher_idx):
        t_id = teachers[t_i]["teacher_id"]
        s_id = students[s_i]["student_id"]
        assignments.setdefault(t_id, []).append(s_id)

    # Fill any leftovers
    all_assigned = {s for lst in assignments.values() for s in lst}
    unassigned = [s for s in students if s["student_id"] not in all_assigned]

    if unassigned:
        teacher_ids = list(assignments.keys())
        for i, stu in enumerate(unassigned):
            target = teacher_ids[i % len(teacher_ids)]
            assignments[target].append(stu["student_id"])

    return assignments


# ============================================================
# CLASS SIZE BALANCING
# ============================================================

def balance_class_sizes(assignments: Dict[str, List[str]], constraints: Dict[str, Any]) -> Dict[str, List[str]]:
    """Keep classes within min/max range while maintaining fairness."""
    max_size = constraints.get("max_class_size", 25)
    min_size = constraints.get("min_class_size", 10)

    all_students = [s for subs in assignments.values() for s in subs]
    teacher_ids = list(assignments.keys())
    avg_size = len(all_students) // max(1, len(teacher_ids))

    new_assignments = {t: [] for t in teacher_ids}
    idx = 0
    for t in teacher_ids:
        size = min(max_size, max(min_size, avg_size))
        new_assignments[t] = all_students[idx:idx + size]
        idx += size

    # handle leftovers
    leftover = all_students[idx:]
    for i, sid in enumerate(leftover):
        new_assignments[teacher_ids[i % len(teacher_ids)]].append(sid)

    return {k: v for k, v in new_assignments.items() if v}


# ============================================================
# LOCAL TEST
# ============================================================

if __name__ == "__main__":
    teachers = [
        {
            "teacher_id": "Mr. David Chen",
            "subject_expertise": 10, "patience_level": 2, "innovation": 7,
            "structure": 9, "communication": 6, "special_needs_support": 1,
            "student_engagement": 5, "classroom_management": 8,
            "teacher_archetype": "High-Performance Coach"
        },
        {
            "teacher_id": "Ms. Amanda Tan",
            "subject_expertise": 9, "patience_level": 10, "innovation": 6,
            "structure": 9, "communication": 8, "special_needs_support": 10,
            "student_engagement": 7, "classroom_management": 8,
            "teacher_archetype": "Special-Needs Specialist"
        }
    ]

    students = [
        {
            "student_id": "Emily",
            "subject_support_needed": 9, "patience_needed": 8,
            "innovation_needed": 5, "structure_needed": 6,
            "communication_needed": 6, "special_needs_support": 2,
            "engagement_needed": 7, "behavior_support_needed": 4,
            "confidence_level": 6,
            "best_teacher_profile": "patient structured teacher"
        },
        {
            "student_id": "Marcus",
            "subject_support_needed": 3, "patience_needed": 10,
            "innovation_needed": 7, "structure_needed": 8,
            "communication_needed": 9, "special_needs_support": 8,
            "engagement_needed": 5, "behavior_support_needed": 3,
            "confidence_level": 8,
            "best_teacher_profile": "special-needs specialist"
        },
        {
            "student_id": "Aisha",
            "subject_support_needed": 8, "patience_needed": 9,
            "innovation_needed": 6, "structure_needed": 5,
            "communication_needed": 7, "special_needs_support": 10,
            "engagement_needed": 8, "behavior_support_needed": 6,
            "confidence_level": 4,
            "best_teacher_profile": "empathetic motivator"
        }
    ]

    matches = run_matching_algorithm(
        teachers, students, {"max_class_size": 2, "min_class_size": 1}
    )

    import json; print(json.dumps(matches, indent=2))
