import plotly.graph_objects as go
from typing import Dict, List

# ============================================================
# HELPER
# ============================================================

def _safe_values(data: Dict, keys: List[str]) -> List[float]:
    """Safely extract numeric values (defaults to 0)."""
    vals = []
    for k in keys:
        try:
            vals.append(float(data.get(k, 0)))
        except (ValueError, TypeError):
            vals.append(0.0)
    return vals


# ============================================================
# STUDENT RADAR CHART
# ============================================================

def create_student_radar(student_data: Dict) -> go.Figure:
    scores = student_data.get("scores", {})  # <-- FIXED
    categories = [
        "Subject Support Needed", "Patience Needed", "Innovation Needed", "Structure Needed",
        "Communication Needed", "Special Needs Support", "Engagement Needed", "Behavior Support Needed"
    ]
    values = [
        float(scores.get("subject_support_needed", 0)),
        float(scores.get("patience_needed", 0)),
        float(scores.get("innovation_needed", 0)),
        float(scores.get("structure_needed", 0)),
        float(scores.get("communication_needed", 0)),
        float(scores.get("special_needs_support", 0)),
        float(scores.get("engagement_needed", 0)),
        float(scores.get("behavior_support_needed", 0))
    ]

    # close the loop for polygon rendering
    categories += [categories[0]]
    values += [values[0]]

    fig = go.Figure()
    fig.add_trace(go.Scatterpolar(
        r=values,
        theta=categories,
        fill="toself",
        name=student_data.get("student_id", "Student"),
        line=dict(color="rgba(220,0,0,0.8)", width=3),
        fillcolor="rgba(255,80,80,0.25)",
        hovertemplate="%{theta}: %{r:.1f}<extra></extra>"
    ))

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
        showlegend=False,
        title=dict(
            text=f"🎯 Student Profile: {student_data.get('student_id', '')}",
            x=0.5, xanchor="center"
        ),
        margin=dict(l=40, r=40, t=60, b=40),
        template="plotly_white"
    )
    return fig


# ============================================================
# TEACHER RADAR CHART
# ============================================================

def create_teacher_radar(teacher_data: Dict) -> go.Figure:
    scores = teacher_data.get("scores", {})  # <-- FIXED
    categories = [
        "Subject Expertise", "Patience Level", "Innovation", "Structure",
        "Communication", "Special Needs Support", "Student Engagement", "Classroom Management"
    ]
    values = [
        float(scores.get("subject_expertise", 0)),
        float(scores.get("patience_level", 0)),
        float(scores.get("innovation", 0)),
        float(scores.get("structure", 0)),
        float(scores.get("communication", 0)),
        float(scores.get("special_needs_support", 0)),
        float(scores.get("student_engagement", 0)),
        float(scores.get("classroom_management", 0))
    ]

    # close the polygon loop
    categories += [categories[0]]
    values += [values[0]]

    fig = go.Figure()
    fig.add_trace(go.Scatterpolar(
        r=values,
        theta=categories,
        fill="toself",
        name=teacher_data.get("teacher_id", "Teacher"),
        line=dict(color="rgba(0,100,255,0.9)", width=3),
        fillcolor="rgba(80,150,255,0.25)",
        hovertemplate="%{theta}: %{r:.1f}<extra></extra>"
    ))

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
        showlegend=False,
        title=dict(
            text=f"🧑‍🏫 Teacher Profile: {teacher_data.get('teacher_id', '')}",
            x=0.5, xanchor="center"
        ),
        margin=dict(l=40, r=40, t=60, b=40),
        template="plotly_white"
    )
    return fig
