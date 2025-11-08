import React, { useState } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';
import { Users, GraduationCap, CheckCircle } from 'lucide-react';

/**
 * INDIVIDUAL STUDENT-TEACHER MATCHING SYSTEM
 * ===========================================
 * This component helps match individual students with the best-fit teacher by:
 * - STUDENTS: Chart shows skill GAPS (what they're missing/weak in)
 * - TEACHERS: Chart shows skill STRENGTHS (what they can provide)
 * - MATCHING ALGORITHM: Finds teacher whose strengths best fill student's gaps
 * 
 * Visual Concept:
 * - Student radar extends FROM EDGE INWARD (gaps = areas of need)
 * - Teacher radar extends FROM CENTER OUTWARD (strengths = what they provide)
 * - Best match = teacher fills the most critical student gaps
 */

// =============================================================================
// DATA STRUCTURES
// =============================================================================

const skills = [
  'Critical Thinking',
  'Problem Solving',
  'Reading Comprehension',
  'Memory & Recall',
  'Curiosity',
  'Responsibility',
  'Emotional Regulation',
  'Cooperation',
  'Communication',
  'Organization'
];

/**
 * Individual student profiles
 * - Higher values = GREATER NEED (areas where student is struggling)
 * - Range 20-80: represents skill gaps that need teacher support
 */
const students = [
  {
    id: 1,
    name: 'Sarah Martinez',
    grade: 'Grade 9A',
    specialNeeds: 'Dyslexia',
    data: skills.map(skill => ({
      skill,
      value: Math.floor(Math.random() * 60) + 20 // Gap score: 20-80
    }))
  },
  {
    id: 2,
    name: 'James Chen',
    grade: 'Grade 9B',
    specialNeeds: 'None',
    data: skills.map(skill => ({
      skill,
      value: Math.floor(Math.random() * 60) + 20
    }))
  },
  {
    id: 3,
    name: 'Emily Johnson',
    grade: 'Grade 10A',
    specialNeeds: 'ADHD',
    data: skills.map(skill => ({
      skill,
      value: Math.floor(Math.random() * 60) + 20
    }))
  },
  {
    id: 4,
    name: 'Marcus Williams',
    grade: 'Grade 9A',
    specialNeeds: 'None',
    data: skills.map(skill => ({
      skill,
      value: Math.floor(Math.random() * 60) + 20
    }))
  },
  {
    id: 5,
    name: 'Aisha Patel',
    grade: 'Grade 10B',
    specialNeeds: 'Anxiety',
    data: skills.map(skill => ({
      skill,
      value: Math.floor(Math.random() * 60) + 20
    }))
  },
  {
    id: 6,
    name: 'Diego Rodriguez',
    grade: 'Grade 9B',
    specialNeeds: 'None',
    data: skills.map(skill => ({
      skill,
      value: Math.floor(Math.random() * 60) + 20
    }))
  }
];

/**
 * Teacher profiles
 * - Higher values = GREATER STRENGTH (what teacher excels at providing)
 * - Range 60-100: represents teaching proficiency
 * - displayValue: Inverted (100-value) for visual "from center outward" effect
 */
const teachers = [
  {
    id: 1,
    name: 'Ms. Johnson',
    subject: 'Mathematics',
    specialization: 'Special Ed Certified',
    data: skills.map(skill => {
      const value = Math.floor(Math.random() * 40) + 60;
      return {
        skill,
        value, // Actual strength
        displayValue: 100 - value // For visualization
      };
    })
  },
  {
    id: 2,
    name: 'Mr. Rodriguez',
    subject: 'Science',
    specialization: 'STEM Focus',
    data: skills.map(skill => {
      const value = Math.floor(Math.random() * 40) + 60;
      return {
        skill,
        value,
        displayValue: 100 - value
      };
    })
  },
  {
    id: 3,
    name: 'Dr. Patel',
    subject: 'English',
    specialization: 'Literacy Specialist',
    data: skills.map(skill => {
      const value = Math.floor(Math.random() * 40) + 60;
      return {
        skill,
        value,
        displayValue: 100 - value
      };
    })
  },
  {
    id: 4,
    name: 'Ms. Thompson',
    subject: 'History',
    specialization: 'Social-Emotional Learning',
    data: skills.map(skill => {
      const value = Math.floor(Math.random() * 40) + 60;
      return {
        skill,
        value,
        displayValue: 100 - value
      };
    })
  }
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function IndividualStudentTeacherMatcher() {
  const [selectedStudent, setSelectedStudent] = useState(students[0]);
  const [matchedTeacher, setMatchedTeacher] = useState(null);
  const [allTeacherScores, setAllTeacherScores] = useState([]);
  const [isMatching, setIsMatching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  /**
   * MATCHING ALGORITHM
   * Calculates compatibility score by comparing student gaps with teacher strengths
   * Higher score = teacher's strengths better address student's weaknesses
   */
  const calculateMatchScore = (student, teacher) => {
    let totalScore = 0;
    let details = [];

    student.data.forEach((studentSkill, index) => {
      const teacherSkill = teacher.data[index];
      
      // Core formula: student need × teacher strength
      // High student gap + High teacher strength = Best match
      const matchContribution = (studentSkill.value * teacherSkill.value) / 100;
      totalScore += matchContribution;
      
      details.push({
        skill: studentSkill.skill,
        studentNeed: studentSkill.value,
        teacherStrength: teacherSkill.value,
        matchScore: matchContribution
      });
    });

    // Normalize to 0-100 scale
    const normalizedScore = (totalScore / skills.length);
    
    return {
      teacher,
      score: Math.round(normalizedScore),
      details: details.sort((a, b) => b.matchScore - a.matchScore)
    };
  };

  /**
   * Find best teacher match for selected student
   */
  const handleFindMatch = () => {
    setIsMatching(true);
    setShowResults(false);
    
    // Calculate scores for all teachers
    const scores = teachers.map(teacher => 
      calculateMatchScore(selectedStudent, teacher)
    ).sort((a, b) => b.score - a.score);
    
    setAllTeacherScores(scores);
    
    // Simulate processing time for animation
    setTimeout(() => {
      setMatchedTeacher(scores[0]); // Best match
      setIsMatching(false);
      
      setTimeout(() => {
        setShowResults(true);
      }, 500);
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <header className="mb-6 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-purple-600 mb-1">
            Student-Teacher Matching System
          </h1>
          <p className="text-sm text-purple-400 font-medium">Find the Perfect Teacher for Each Student</p>
        </header>

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* STUDENT SELECTION SECTION */}
          <section className="bg-rose-100 border-2 border-rose-300 p-4 sm:p-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <GraduationCap className="w-5 h-5 text-rose-600" />
              <h2 className="text-xl font-bold text-rose-600">Select Student</h2>
            </div>

            {/* Student Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {students.map(student => (
                <button
                  key={student.id}
                  onClick={() => {
                    setSelectedStudent(student);
                    setMatchedTeacher(null);
                    setShowResults(false);
                  }}
                  className={`p-3 border-2 rounded transition-all min-h-[80px] flex flex-col items-start justify-center text-left ${
                    selectedStudent.id === student.id
                      ? 'border-rose-500 bg-rose-200 shadow-md'
                      : 'border-rose-300 bg-white hover:bg-rose-50 hover:border-rose-400'
                  }`}
                >
                  <span className={`font-bold text-sm mb-1 ${
                    selectedStudent.id === student.id ? 'text-rose-700' : 'text-rose-600'
                  }`}>
                    {student.name}
                  </span>
                  <span className="text-xs text-gray-600">{student.grade}</span>
                  {student.specialNeeds !== 'None' && (
                    <span className="text-xs text-purple-600 font-semibold mt-1">
                      {student.specialNeeds}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Student Skill Gaps Chart */}
            <div className="bg-white border-2 border-rose-200 rounded p-4 h-96">
              <p className="text-xs text-center text-rose-600 font-semibold mb-2">
                Skill Gaps (← Areas Needing Support)
              </p>
              <ResponsiveContainer width="100%" height="90%">
                <RadarChart data={selectedStudent.data}>
                  <PolarGrid stroke="#fecdd3" />
                  <PolarAngleAxis 
                    dataKey="skill" 
                    tick={{ fill: '#e11d48', fontSize: 10, fontWeight: 600 }}
                  />
                  <PolarRadiusAxis 
                    angle={90} 
                    domain={[0, 100]} 
                    stroke="#fda4af"
                    tick={{ fill: '#e11d48', fontSize: 9 }}
                  />
                  <Radar
                    name="Need Level"
                    dataKey="value"
                    stroke="#e11d48"
                    fill="#e11d48"
                    fillOpacity={0.4}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Match Button */}
            <button
              onClick={handleFindMatch}
              disabled={isMatching}
              className={`
                w-full px-6 py-3 rounded border-2 font-bold text-base mt-4
                transition-all duration-200
                ${isMatching 
                  ? 'border-gray-300 bg-gray-200 text-gray-500 cursor-not-allowed' 
                  : 'border-purple-500 bg-purple-400 text-white hover:bg-purple-500'
                }
              `}
            >
              {isMatching ? 'Finding Best Match...' : 'Find Best Teacher Match'}
            </button>
          </section>

          {/* TEACHER MATCH RESULTS SECTION */}
          <section className="bg-blue-100 border-2 border-blue-300 p-4 sm:p-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Users className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-bold text-blue-600">Best Teacher Match</h2>
            </div>

            {!matchedTeacher && !isMatching && (
              <div className="flex items-center justify-center h-[500px] text-gray-400">
                <div className="text-center">
                  <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-semibold">No match yet</p>
                  <p className="text-sm">Click "Find Best Teacher Match" to begin</p>
                </div>
              </div>
            )}

            {matchedTeacher && (
              <>
                {/* Teacher Info Card */}
                <div className="bg-white border-2 border-blue-300 rounded p-4 mb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-blue-700 flex items-center gap-2">
                        {matchedTeacher.teacher.name}
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      </h3>
                      <p className="text-sm text-gray-600">{matchedTeacher.teacher.subject}</p>
                      <p className="text-xs text-purple-600 font-semibold mt-1">
                        {matchedTeacher.teacher.specialization}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-purple-600">{matchedTeacher.score}%</p>
                      <p className="text-xs text-gray-500">Match Score</p>
                    </div>
                  </div>
                </div>

                {/* Teacher Strengths Chart */}
                <div className="bg-white border-2 border-blue-200 rounded p-4 h-96 mb-4">
                  <p className="text-xs text-center text-blue-600 font-semibold mb-2">
                    Teacher Strengths (→ Can Provide)
                  </p>
                  <ResponsiveContainer width="100%" height="90%">
                    <RadarChart data={matchedTeacher.teacher.data}>
                      <PolarGrid stroke="#bfdbfe" />
                      <PolarAngleAxis 
                        dataKey="skill" 
                        tick={{ fill: '#3b82f6', fontSize: 10, fontWeight: 600 }}
                      />
                      <PolarRadiusAxis 
                        angle={90} 
                        domain={[0, 100]} 
                        stroke="#93c5fd"
                        tick={{ fill: '#3b82f6', fontSize: 9 }}
                      />
                      <Radar
                        name="Strength"
                        dataKey="displayValue"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.4}
                        strokeWidth={2}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </section>
        </div>

        {/* MATCHING ANIMATION OVERLAY */}
        {isMatching && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/40">
            <div className="relative w-[700px] h-[600px] bg-white/98 rounded-lg border-4 border-purple-400 shadow-2xl p-8">
              <div className="text-center mb-4">
                <h3 className="text-2xl font-bold text-purple-600 mb-1">Analyzing Compatibility...</h3>
                <p className="text-sm text-gray-600">Matching {selectedStudent.name} with best teacher</p>
              </div>
              
              {/* Overlaid Charts */}
              <div className="relative h-[450px] mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={selectedStudent.data}>
                    <PolarGrid stroke="#d1d5db" strokeWidth={1.5} />
                    <PolarAngleAxis 
                      dataKey="skill" 
                      tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 700 }}
                    />
                    <PolarRadiusAxis 
                      angle={90} 
                      domain={[0, 100]} 
                      stroke="#9ca3af"
                      tick={{ fill: '#6b7280', fontSize: 9 }}
                    />
                    
                    {/* Student gaps */}
                    <Radar
                      name="Student Gaps"
                      dataKey="value"
                      data={selectedStudent.data}
                      stroke="#e11d48"
                      fill="#e11d48"
                      fillOpacity={0.5}
                      strokeWidth={3}
                      className="animate-pulse"
                    />
                    
                    {/* All teachers (cycling through) */}
                    {teachers.map((teacher, idx) => (
                      <Radar
                        key={teacher.id}
                        name={teacher.name}
                        dataKey="displayValue"
                        data={teacher.data}
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.3}
                        strokeWidth={2}
                        className="animate-pulse"
                        style={{ 
                          animationDelay: `${idx * 0.2}s`,
                          opacity: 0.6
                        }}
                      />
                    ))}
                  </RadarChart>
                </ResponsiveContainer>
                
                {/* Labels */}
                <div className="absolute top-4 left-4 bg-rose-100 border-2 border-rose-400 rounded px-3 py-2">
                  <p className="text-sm font-bold text-rose-700">{selectedStudent.name}</p>
                  <p className="text-xs text-rose-600">Skill Gaps</p>
                </div>
                <div className="absolute top-4 right-4 bg-blue-100 border-2 border-blue-400 rounded px-3 py-2">
                  <p className="text-sm font-bold text-blue-700">Evaluating Teachers...</p>
                  <p className="text-xs text-blue-600">Finding Best Fit</p>
                </div>
                
                {/* Center pulse */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-4 border-purple-400 rounded-full animate-ping" />
                    <div className="absolute inset-2 border-4 border-pink-400 rounded-full animate-ping" style={{ animationDelay: '0.3s' }} />
                  </div>
                </div>
              </div>
              
              <div className="text-center text-sm text-gray-600">
                <p className="font-semibold">Calculating which teacher best fills student's gaps...</p>
              </div>
            </div>
          </div>
        )}

        {/* DETAILED RESULTS SECTION */}
        {showResults && matchedTeacher && (
          <div className="mt-6 bg-white border-2 border-purple-300 rounded p-6 animate-fade-in">
            <h3 className="text-xl font-bold text-purple-600 mb-4 text-center">Match Analysis</h3>
            
            {/* Top 3 Teachers */}
            <div className="mb-6">
              <h4 className="text-sm font-bold text-gray-700 mb-3">Teacher Rankings:</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {allTeacherScores.slice(0, 3).map((result, idx) => (
                  <div 
                    key={result.teacher.id}
                    className={`border-2 rounded p-3 ${
                      idx === 0 
                        ? 'border-green-400 bg-green-50' 
                        : 'border-gray-300 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-gray-700">
                        #{idx + 1} {result.teacher.name}
                      </span>
                      {idx === 0 && <CheckCircle className="w-4 h-4 text-green-600" />}
                    </div>
                    <div className="text-2xl font-bold text-purple-600">{result.score}%</div>
                    <div className="text-xs text-gray-600">{result.teacher.specialization}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 3 Match Areas */}
            <div>
              <h4 className="text-sm font-bold text-gray-700 mb-3">
                Why {matchedTeacher.teacher.name} is the best match:
              </h4>
              <div className="space-y-2">
                {matchedTeacher.details.slice(0, 3).map((detail, idx) => (
                  <div key={idx} className="bg-purple-50 border border-purple-200 rounded p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm text-purple-700">{detail.skill}</span>
                      <span className="text-xs font-bold text-purple-600">
                        Match: {Math.round(detail.matchScore)}/100
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-rose-600">Student Need: </span>
                        <span className="font-semibold">{detail.studentNeed}%</span>
                      </div>
                      <div>
                        <span className="text-blue-600">Teacher Strength: </span>
                        <span className="font-semibold">{detail.teacherStrength}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
