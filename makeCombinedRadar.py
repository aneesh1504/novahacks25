import plotly.graph_objects as go
from typing import Dict, List
import numpy as np

# ============================================================
# COMBINED RADAR (Teacher + Student Overlay)
# ============================================================

def create_combined_radar(teacher_data: Dict, student_data: Dict) -> go.Figure:
    """
    Create an overlaid radar chart showing how a student's needs
    align with a teacher's capabilities. Both radiate outward (0–10 scale).
    """

    categories = [
        "Subject Area",
        "Patience",
        "Innovation",
        "Structure",
        "Communication",
        "Special Needs",
        "Engagement",
        "Behavior Management",
    ]

    student_scores = student_data.get("scores", {})
    teacher_scores = teacher_data.get("scores", {})


    # --- Student and teacher values ---
    student_values = [
        float(student_scores.get("subject_support_needed", 0)),
        float(student_scores.get("patience_needed", 0)),
        float(student_scores.get("innovation_needed", 0)),
        float(student_scores.get("structure_needed", 0)),
        float(student_scores.get("communication_needed", 0)),
        float(student_scores.get("special_needs_support", 0)),
        float(student_scores.get("engagement_needed", 0)),
        float(student_scores.get("behavior_support_needed", 0)),
    ]

    teacher_values = [
        float(teacher_scores.get("subject_expertise", 0)),
        float(teacher_scores.get("patience_level", 0)),
        float(teacher_scores.get("innovation", 0)),
        float(teacher_scores.get("structure", 0)),
        float(teacher_scores.get("communication", 0)),
        float(teacher_scores.get("special_needs_support", 0)),
        float(teacher_scores.get("student_engagement", 0)),
        float(teacher_scores.get("classroom_management", 0)),
    ]

    # close the polygons for better rendering
    categories += [categories[0]]
    student_values += [student_values[0]]
    teacher_values += [teacher_values[0]]

    # --- Create Plotly figure ---
    fig = go.Figure()

    # Student trace (red)
    fig.add_trace(go.Scatterpolar(
        r=student_values,
        theta=categories,
        fill="toself",
        name=f"Student: {student_data.get('student_id', 'Unknown')}",
        line=dict(color="rgba(255,0,0,0.9)", width=3),
        fillcolor="rgba(255,100,100,0.25)",
        hovertemplate="%{theta}: %{r:.1f}<extra></extra>"
    ))

    # Teacher trace (blue)
    fig.add_trace(go.Scatterpolar(
        r=teacher_values,
        theta=categories,
        fill="toself",
        name=f"Teacher: {teacher_data.get('teacher_id', 'Unknown')}",
        line=dict(color="rgba(0,100,255,0.9)", width=3),
        fillcolor="rgba(100,150,255,0.25)",
        hovertemplate="%{theta}: %{r:.1f}<extra></extra>"
    ))

    # --- Compute compatibility score ---
    overlap_score = calculate_overlap_score(student_values[:-1], teacher_values[:-1])

    # --- Layout ---
    fig.update_layout(
        polar=dict(
            radialaxis=dict(
                visible=True,
                range=[0, 10],
                tickvals=[0, 2, 4, 6, 8, 10],
                tickfont=dict(size=11),
                gridcolor="lightgray"
            ),
            angularaxis=dict(tickfont=dict(size=12))
        ),
        showlegend=True,
        legend=dict(orientation="h", y=-0.15, x=0.25),
        title=dict(
            text=f"💡 Match Score: {overlap_score:.1f}/10",
            x=0.5, xanchor="center"
        ),
        margin=dict(l=40, r=40, t=80, b=60),
        template="plotly_white"
    )

    return fig


# ============================================================
# SCORE CALCULATION
# ============================================================

def calculate_overlap_score(student_needs: List[float], teacher_capabilities: List[float]) -> float:
    """
    Compute how well a teacher's strengths align with a student's needs.
    A perfect match = both have high scores in the same dimensions.
    """
    if not student_needs or not teacher_capabilities:
        return 0.0

    student_needs = np.array(student_needs)
    teacher_capabilities = np.array(teacher_capabilities)

    # Basic score: difference penalty
    diff = np.abs(student_needs - teacher_capabilities)
    base_score = np.maximum(0, 10 - diff)

    # Bonus for mutual high (≥8) or mutual moderate (5–7) values
    high_overlap_bonus = np.mean([
        1.0 if (s >= 8 and t >= 8) else 0.5 if (5 <= s <= 7 and 5 <= t <= 7) else 0
        for s, t in zip(student_needs, teacher_capabilities)
    ])

    # Final compatibility out of 10
    score = np.clip(np.mean(base_score) + high_overlap_bonus, 0, 10)
    return round(float(score), 2)


# ============================================================
# UTILITY
# ============================================================

def _safe_values(data: Dict, keys: List[str]) -> List[float]:
    vals = []
    for k in keys:
        try:
            vals.append(float(data.get(k, 0)))
        except (TypeError, ValueError):
            vals.append(0.0)
    return vals
