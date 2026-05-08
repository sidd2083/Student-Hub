import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <>
      <Helmet>
        <title>Privacy Policy — Student Hub</title>
        <meta name="description" content="Privacy Policy for Student Hub — how we collect, use and protect your data." />
      </Helmet>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-gray-400 text-sm mb-8">Last updated: May 2026</p>

          <div className="prose prose-gray max-w-none text-sm leading-relaxed space-y-6">
            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">1. Information We Collect</h2>
              <p className="text-gray-600">When you register with Student Hub, we collect:</p>
              <ul className="list-disc pl-5 text-gray-600 space-y-1 mt-2">
                <li>Your name and email address (from your Google account)</li>
                <li>Your grade level (9–12)</li>
                <li>Study activity data: session times, tasks completed, notes viewed</li>
                <li>Device and browser information for functionality purposes</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">2. How We Use Your Information</h2>
              <p className="text-gray-600">We use your information to:</p>
              <ul className="list-disc pl-5 text-gray-600 space-y-1 mt-2">
                <li>Provide personalized study tracking and progress reports</li>
                <li>Calculate your streak and study leaderboard ranking</li>
                <li>Deliver AI-powered study assistance through Nep AI</li>
                <li>Show relevant content based on your grade</li>
                <li>Display non-personalized advertisements to keep the platform free</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">3. Data Storage and Security</h2>
              <p className="text-gray-600">Your data is stored securely in a PostgreSQL database. Authentication is handled by Google Firebase with industry-standard encryption. We do not sell your personal information to third parties.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">4. Third-Party Services</h2>
              <p className="text-gray-600">Student Hub uses the following third-party services:</p>
              <ul className="list-disc pl-5 text-gray-600 space-y-1 mt-2">
                <li><strong>Google Sign-In / Firebase</strong> — authentication</li>
                <li><strong>Google AdSense</strong> — display advertising</li>
                <li><strong>OpenAI</strong> — AI study assistant (Nep AI)</li>
              </ul>
              <p className="text-gray-600 mt-2">Each service has its own privacy policy. Google's advertising may use cookies to show relevant ads.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">5. Cookies</h2>
              <p className="text-gray-600">We use browser localStorage and sessionStorage for functionality (e.g., timer state, dismissed notifications). Google AdSense may use cookies for advertising. You can disable cookies in your browser settings, but this may affect functionality.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">6. Children's Privacy</h2>
              <p className="text-gray-600">Student Hub is designed for students aged 14 and above (Grade 9–12). We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided us with personal information, please contact us immediately.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">7. Your Rights</h2>
              <p className="text-gray-600">You have the right to:</p>
              <ul className="list-disc pl-5 text-gray-600 space-y-1 mt-2">
                <li>Access your personal data (available in your profile/settings)</li>
                <li>Request deletion of your account and associated data</li>
                <li>Export your study data</li>
              </ul>
              <p className="text-gray-600 mt-2">To exercise these rights, contact us at the address below.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-2">8. Contact</h2>
              <p className="text-gray-600">For any privacy-related questions or requests, please contact us through the <Link href="/contact" className="text-blue-500 hover:underline">Contact page</Link>.</p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
