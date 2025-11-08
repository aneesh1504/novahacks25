import plotly.graph_objects as go
from typing import Dict, List

# ============================================================
# COMBINED RADAR (Teacher + Student Overlay)
# ============================================================

def create_combined_radar(teacher_data: Dict, student_data: Dict) -> go.Figure:
    """
    Create an overlaid radar chart showing how a student's needs
    align with a teacher's capabilities.
    The student's spikes go outward; the teacher's strengths stem inward.
    """

    categories = [
        "Subject Area",
        "Patience",
        "Innovation",
        "Structure",
        "Communication",
        "Special Needs",
        "Engagement",
        "Behavior Management"
    ]

    # --- Extract and normalize student needs (outward spikes) ---
    student_values = [
        float(student_data.get("subject_support_needed", 0)),
        float(student_data.get("patience_needed", 0)),
        float(student_data.get("innovation_needed", 0)),
        float(student_data.get("structure_needed", 0)),
        float(student_data.get("communication_needed", 0)),
        float(student_data.get("special_needs_support", 0)),
        float(student_data.get("engagement_needed", 0)),
        float(student_data.get("behavior_support_needed", 0)),
    ]

    # --- Extract teacher capabilities (inward from circumference) ---
    teacher_raw = [
        float(teacher_data.get("subject_expertise", 0)),
        float(teacher_data.get("patience_level", 0)),
        float(teacher_data.get("innovation", 0)),
        float(teacher_data.get("structure", 0)),
        float(teacher_data.get("communication", 0)),
        float(teacher_data.get("special_needs_support", 0)),
        float(teacher_data.get("student_engagement", 0)),
        float(teacher_data.get("classroom_management", 0)),
    ]
    teacher_values = [10 - v for v in teacher_raw]

    # --- Create Plotly figure ---
    fig = go.Figure()

    # Student trace (outward, red)
    fig.add_trace(go.Scatterpolar(
        r=student_values,
        theta=categories,
        fill="toself",
        name=f"Student: {student_data.get('student_id', 'Unknown')}",
        line=dict(color="red", width=2),
        fillcolor="rgba(255,0,0,0.25)"
    ))

    # Teacher trace (inward, blue)
    fig.add_trace(go.Scatterpolar(
        r=teacher_values,
        theta=categories,
        fill="toself",
        name=f"Teacher: {teacher_data.get('teacher_id', 'Unknown')}",
        line=dict(color="blue", width=2),
        fillcolor="rgba(0,0,255,0.25)"
    ))

    # --- Compute compatibility score ---
    overlap_score = calculate_overlap_score(student_values, teacher_raw)

    fig.update_layout(
        polar=dict(
            radialaxis=dict(visible=True, range=[0, 10]),
        ),
        showlegend=True,
        title=f"💡 Teacher–Student Match Score: {overlap_score:.1f}/10"
    )

    return fig


# ============================================================
# SCORE CALCULATION
# ============================================================

def calculate_overlap_score(student_needs: List[float], teacher_capabilities: List[float]) -> float:
    """
    Compute how well a teacher's strengths complement a student's needs.
    A perfect match = teacher capability ≈ student need (on inverse scales).
    """
    if not student_needs or not teacher_capabilities:
        return 0.0

    total_score = 0.0
    for need, capability in zip(student_needs, teacher_capabilities):
        # Ideal: high need matched by high capability (both ~10)
        # Scale match between 0–10, penalizing mismatch
        diff = abs(need - (10 - capability))
        score = max(0, 10 - diff)
        total_score += score

    return round(total_score / len(student_needs), 2)
