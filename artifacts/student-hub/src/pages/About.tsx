import { Helmet } from "react-helmet-async";
import { BookOpen, Users, Target, Mail } from "lucide-react";

export default function About() {
  return (
    <>
      <Helmet>
        <title>About — Student Hub</title>
        <meta name="description" content="Student Hub is a free study platform for Grade 9–12 students in Nepal. Access notes, past papers, Nep AI, and progress tracking." />
        <meta property="og:title" content="About — Student Hub" />
        <meta property="og:description" content="Free study platform for Nepali students. Notes, PYQs, Nep AI, and progress tracking — all in one place." />
      </Helmet>

      <div className="min-h-screen bg-gray-50">
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <div className="text-center mb-12">
            <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">About Student Hub</h1>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              A free, modern study platform built for Nepali students in Grades 9–12.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 mb-12">
            {[
              {
                icon: Target,
                title: "Our Mission",
                desc: "Make quality study materials accessible to every student in Nepal — completely free.",
                color: "bg-blue-50 text-blue-600",
              },
              {
                icon: Users,
                title: "Who It's For",
                desc: "Students preparing for SEE, NEB, and grade-wise exams across all subjects.",
                color: "bg-green-50 text-green-600",
              },
              {
                icon: Mail,
                title: "Get In Touch",
                desc: "Have feedback or suggestions? We'd love to hear from you. Reach out anytime.",
                color: "bg-purple-50 text-purple-600",
              },
            ].map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center mb-4`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">What We Offer</h2>
            <div className="space-y-3">
              {[
                ["📚", "Notes", "Study notes organized by grade, subject, and chapter — text, PDF, and image formats."],
                ["📄", "Previous Year Questions (PYQ)", "Past exam papers from various provinces and boards."],
                ["📊", "Report Card", "Track your study time, streak, and progress with daily analytics and badges."],
                ["🤖", "Nep AI", "An AI study assistant that answers your academic questions in seconds."],
                ["⏱", "Pomodoro Timer", "Built-in focus timer to help you study smarter."],
                ["✅", "To-Do", "Task manager to keep your study schedule on track."],
              ].map(([emoji, feature, desc]) => (
                <div key={feature as string} className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
                  <span className="text-xl flex-shrink-0">{emoji}</span>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{feature}</p>
                    <p className="text-sm text-gray-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-2">About Us</h2>
            <p className="text-gray-600">
              Student Hub is a product of <strong>Tufan Production</strong>, built to help Nepali students access
              quality study materials without any barriers.
            </p>
          </div>
        </main>
      </div>
    </>
  );
}

