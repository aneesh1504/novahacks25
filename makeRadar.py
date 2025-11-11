import streamlit as st
import plotly.graph_objects as go
from typing import Dict

# ============================================================
# STUDENT RADAR CHART
# ============================================================

def create_student_radar(student_data: Dict) -> go.Figure:
    """
    Create a student radar chart (values radiate outward from center).
    Expects student_data dict with 1–10 values for each dimension.
    """
    categories = [
        "Subject Support Needed",
        "Patience Needed",
        "Innovation Needed",
        "Structure Needed",
        "Communication Needed",
        "Special Needs Support",
        "Engagement Needed",
        "Behavior Support Needed"
    ]

    values = [
        float(student_data.get("subject_support_needed", 0)),
        float(student_data.get("patience_needed", 0)),
        float(student_data.get("innovation_needed", 0)),
        float(student_data.get("structure_needed", 0)),
        float(student_data.get("communication_needed", 0)),
        float(student_data.get("special_needs_support", 0)),
        float(student_data.get("engagement_needed", 0)),
        float(student_data.get("behavior_support_needed", 0))
    ]

    fig = go.Figure()
    fig.add_trace(go.Scatterpolar(
        r=values,
        theta=categories,
        fill="toself",
        name=student_data.get("student_id", "Student"),
        line=dict(color="red", width=3),
        fillcolor="rgba(255,0,0,0.25)"
    ))

    fig.update_layout(
        polar=dict(
            radialaxis=dict(visible=True, range=[0, 10], tickvals=[0,2,4,6,8,10]),
        ),
        showlegend=True,
        title=f"🎯 Student Needs Profile: {student_data.get('student_id', '')}",
        margin=dict(l=40, r=40, t=80, b=40)
    )
    return fig


# ============================================================
# TEACHER RADAR CHART
# ============================================================

def create_teacher_radar(teacher_data: Dict) -> go.Figure:
    """
    Create a teacher radar chart (same outward orientation as student radar).
    Expects teacher_data dict with 1–10 values for each capability dimension.
    """
    categories = [
        "Subject Expertise",
        "Patience Level",
        "Innovation",
        "Structure",
        "Communication",
        "Special Needs Support",
        "Student Engagement",
        "Classroom Management"
    ]

    values = [
        float(teacher_data.get("subject_expertise", 0)),
        float(teacher_data.get("patience_level", 0)),
        float(teacher_data.get("innovation", 0)),
        float(teacher_data.get("structure", 0)),
        float(teacher_data.get("communication", 0)),
        float(teacher_data.get("special_needs_support", 0)),
        float(teacher_data.get("student_engagement", 0)),
        float(teacher_data.get("classroom_management", 0))
    ]

    fig = go.Figure()
    fig.add_trace(go.Scatterpolar(
        r=values,
        theta=categories,
        fill="toself",
        name=teacher_data.get("teacher_id", "Teacher"),
        line=dict(color="blue", width=3),
        fillcolor="rgba(0,0,255,0.25)"
    ))

    fig.update_layout(
        polar=dict(
            radialaxis=dict(visible=True, range=[0, 10], tickvals=[0,2,4,6,8,10]),
        ),
        showlegend=True,
        title=f"🧑‍🏫 Teacher Capability Profile: {teacher_data.get('teacher_id', '')}",
        margin=dict(l=40, r=40, t=80, b=40)
    )
    return fig
