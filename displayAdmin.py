import streamlit as st
import json
from teacherRadar import process_teacher_data
from studentRadar import process_student_data
from matchingAlgo import run_matching_algorithm
from makeRadar import create_teacher_radar, create_student_radar
from makeCombinedRadar import create_combined_radar

# ============================================================
# HELPER FUNCTIONS
# ============================================================

def process_all_teachers(teacher_files):
    """Process all uploaded teacher files into radar-compatible JSON."""
    teachers = []
    for idx, file in enumerate(teacher_files):
        teacher_id = f"Teacher_{idx+1}"
        result = process_teacher_data(file, teacher_id)
        teachers.append(result)
    return teachers

def process_all_students(student_file):
    """Process uploaded student CSV into radar-compatible JSON."""
    results = process_student_data(student_file)
    return results


# ============================================================
# MAIN STREAMLIT APP
# ============================================================

def main():
    st.set_page_config(page_title="Education Matching System", layout="wide")
    st.title("🎓 Teacher–Student Matching System")

    # -------------------- SIDEBAR --------------------
    with st.sidebar:
        st.header("📁 Data Upload")

        teacher_files = st.file_uploader(
            "Upload Teacher Documents",
            accept_multiple_files=True,
            type=["txt", "docx", "pdf"]
        )

        student_file = st.file_uploader(
            "Upload Student Data (CSV)",
            type=["csv"]
        )

        if st.button("🚀 Process Data"):
            if teacher_files and student_file:
                with st.spinner("Analyzing teacher profiles..."):
                    teacher_data = process_all_teachers(teacher_files)
                    st.session_state.teacher_data = teacher_data

                with st.spinner("Analyzing student data..."):
                    student_data = process_all_students(student_file)
                    st.session_state.student_data = student_data

                st.success("✅ Data processed successfully!")
            else:
                st.error("Please upload both teacher and student data first.")

    # -------------------- TEACHER PROFILE SECTION --------------------
    col1, col2 = st.columns(2)

    with col1:
        st.header("👨‍🏫 Teacher Profiles")

        if "teacher_data" in st.session_state:
            teacher_names = [t["teacher_id"] for t in st.session_state.teacher_data]
            selected_teacher = st.selectbox("Select a Teacher", teacher_names)

            if selected_teacher:
                teacher_info = next(
                    t for t in st.session_state.teacher_data if t["teacher_id"] == selected_teacher
                )
                st.plotly_chart(create_teacher_radar(teacher_info), use_container_width=True)

                with st.expander("View Teacher Details"):
                    st.write(f"**Strengths:** {', '.join(teacher_info.get('raw_strengths', []))}")
                    st.write(f"**Areas for Growth:** {', '.join(teacher_info.get('raw_weaknesses', []))}")

    # -------------------- STUDENT PROFILE SECTION --------------------
    with col2:
        st.header("👩‍🎓 Student Profiles")

        if "student_data" in st.session_state:
            student_names = [s["student_id"] for s in st.session_state.student_data]
            selected_student = st.selectbox("Select a Student", student_names)

            if selected_student:
                student_info = next(
                    s for s in st.session_state.student_data if s["student_id"] == selected_student
                )
                st.plotly_chart(create_student_radar(student_info), use_container_width=True)

    # -------------------- MATCHING SECTION --------------------
    st.divider()
    st.header("🔄 Run Matching Algorithm")

    if "teacher_data" in st.session_state and "student_data" in st.session_state:
        max_class_size = st.number_input("Max Class Size", value=25, min_value=1)
        min_class_size = st.number_input("Min Class Size", value=10, min_value=1)

        if st.button("🧩 Generate Optimal Matches", type="primary"):
            with st.spinner("Running matching algorithm..."):
                matches = run_matching_algorithm(
                    st.session_state.teacher_data,
                    st.session_state.student_data,
                    {"max_class_size": max_class_size, "min_class_size": min_class_size},
                )
                st.session_state.matches = matches
                st.success("✅ Matches generated successfully!")

    # -------------------- DISPLAY MATCHES --------------------
    if "matches" in st.session_state:
        st.divider()
        st.header("📊 Optimal Matches")

        for teacher_id, student_list in st.session_state.matches.items():
            with st.expander(f"🧑‍🏫 {teacher_id} – {len(student_list)} Students"):
                for student_id in student_list:
                    teacher_info = next(
                        t for t in st.session_state.teacher_data if t["teacher_id"] == teacher_id
                    )
                    student_info = next(
                        s for s in st.session_state.student_data if s["student_id"] == student_id
                    )

                    st.subheader(f"Match: {student_id}")
                    st.plotly_chart(
                        create_combined_radar(teacher_info, student_info),
                        use_container_width=True
                    )

# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    main()
