import streamlit as st
import json
from teacherRadar import process_teacher_data, extract_teacher_name, extract_document_text
from studentRadar import process_student_data
from matchingAlgo import run_matching_algorithm
from makeRadar import create_teacher_radar, create_student_radar
from makeCombinedRadar import create_combined_radar

# ============================================================
# HELPER FUNCTIONS
# ============================================================

def process_all_teachers(teacher_files):
    """Process uploaded teacher PDFs into radar-compatible profiles."""
    teachers = []
    for idx, file in enumerate(teacher_files):
        text_preview = extract_document_text(file)
        teacher_name = extract_teacher_name(text_preview, f"Teacher_{idx+1}")
        result = process_teacher_data(file, teacher_name)
        teachers.append(result)
    return teachers


def process_all_students(student_file):
    """Process uploaded student CSV into radar-compatible profiles."""
    return process_student_data(student_file)


# ============================================================
# MAIN STREAMLIT APP
# ============================================================

def main():
    st.set_page_config(page_title="Education Matching System", layout="wide")
    st.title("🎓 Teacher–Student Matching System")

    # Sidebar controls
    with st.sidebar:
        st.header("📁 Upload Data")

        teacher_files = st.file_uploader(
            "Upload Teacher Profiles (PDF/TXT)",
            accept_multiple_files=True,
            type=["txt", "pdf"]
        )
        student_file = st.file_uploader("Upload Student Dataset (CSV)", type=["csv"])

        max_class_size = st.number_input("Max Class Size", value=25, min_value=1)
        min_class_size = st.number_input("Min Class Size", value=10, min_value=1)

        if st.button("🚀 Process Data"):
            if not teacher_files or not student_file:
                st.error("Please upload both teacher and student data first.")
            else:
                with st.spinner("Analyzing teacher profiles..."):
                    teacher_data = process_all_teachers(teacher_files)
                    st.session_state.teacher_data = teacher_data

                with st.spinner("Analyzing student data..."):
                    student_data = process_all_students(student_file)
                    st.session_state.student_data = student_data

                st.success("✅ Data processed successfully!")

    # ============================================================
    # TEACHER AND STUDENT RADARS
    # ============================================================

    if "teacher_data" in st.session_state and "student_data" in st.session_state:
        col1, col2 = st.columns(2)

        # ----- TEACHERS -----
        with col1:
            st.header("👨‍🏫 Teacher Profiles")
            teacher_names = [t["teacher_id"] for t in st.session_state.teacher_data]
            selected_teacher = st.selectbox("Select a Teacher", teacher_names)

            if selected_teacher:
                teacher_info = next(
                    t for t in st.session_state.teacher_data if t["teacher_id"] == selected_teacher
                )
                st.plotly_chart(create_teacher_radar(teacher_info), use_container_width=True)
                with st.expander("📝 Teacher Summary"):
                    st.markdown(
                        f"**Strengths:** {', '.join(teacher_info.get('raw_strengths', [])) or 'N/A'}"
                    )
                    st.markdown(
                        f"**Areas for Growth:** {', '.join(teacher_info.get('raw_weaknesses', [])) or 'N/A'}"
                    )

        # ----- STUDENTS -----
        with col2:
            st.header("👩‍🎓 Student Profiles")
            student_names = [s["student_id"] for s in st.session_state.student_data]
            selected_student = st.selectbox("Select a Student", student_names)

            if selected_student:
                student_info = next(
                    s for s in st.session_state.student_data if s["student_id"] == selected_student
                )
                st.plotly_chart(create_student_radar(student_info), use_container_width=True)

    # ============================================================
    # RUN MATCHING ALGORITHM
    # ============================================================

    st.divider()
    st.header("🔄 Run Matching Algorithm")

    if (
        "teacher_data" in st.session_state
        and "student_data" in st.session_state
        and st.button("🧩 Generate Optimal Matches", type="primary")
    ):
        with st.spinner("Running optimization..."):
            matches = run_matching_algorithm(
                st.session_state.teacher_data,
                st.session_state.student_data,
                {"max_class_size": max_class_size, "min_class_size": min_class_size},
            )
            st.session_state.matches = matches
            st.success("✅ Matches generated successfully!")

    # ============================================================
    # DISPLAY MATCH RESULTS
    # ============================================================

    if "matches" in st.session_state:
        st.divider()
        st.header("📊 Optimal Teacher–Student Matches")

        for teacher_id, student_list in st.session_state.matches.items():
            teacher_info = next(
                t for t in st.session_state.teacher_data if t["teacher_id"] == teacher_id
            )
            with st.expander(f"🧑‍🏫 {teacher_id} — {len(student_list)} students"):
                for student_id in student_list:
                    student_info = next(
                        s for s in st.session_state.student_data if s["student_id"] == student_id
                    )

                    st.subheader(f"🎯 Match: {student_id}")
                    fig = create_combined_radar(teacher_info, student_info)
                    st.plotly_chart(fig, use_container_width=True)

                    # (Optional future enhancement)
                    # Generate short AI match summary here:
                    # summary = generate_match_summary(teacher_info, student_info)
                    # st.caption(summary)


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    main()
