"use client";

import { useState } from "react";
import { PermitRoadmap } from "./components/PermitRoadmap";
import { QuestionsForm } from "./components/QuestionsForm";

interface Question {
  id: string;
  question: string;
  why: string;
  options?: string[];
}

interface QuestionsData {
  phase: "questions";
  project_summary: string;
  questions: Question[];
  preliminary_assessment: string;
}

export default function Home() {
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<QuestionsData | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"quick" | "detailed">("detailed");

  const examples = [
    "I want to build an ADU in my backyard",
    "I need to replace my water heater",
    "I want to install solar panels on my roof",
    "I'm planning a kitchen remodel with new plumbing",
    "I want to build a 6-foot fence around my yard",
    "I want to convert my garage into a living space",
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setQuestions(null);

    try {
      const res = await fetch("/api/navigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_description: description,
          property_address: address || undefined,
          include_questions: mode === "detailed",
        }),
      });

      if (!res.ok) throw new Error("Failed to get permit guidance");
      const data = await res.json();

      if (data.phase === "questions") {
        setQuestions(data as QuestionsData);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleAnswersSubmit(answers: Record<string, string>) {
    setLoading(true);
    setError(null);
    setQuestions(null);

    try {
      const res = await fetch("/api/navigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_description: description,
          property_address: address || undefined,
          answers,
        }),
      });

      if (!res.ok) throw new Error("Failed to generate roadmap");
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleSkipQuestions() {
    setQuestions(null);
    setLoading(true);
    setError(null);

    fetch("/api/navigate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_description: description,
        property_address: address || undefined,
      }),
    })
      .then((res) => res.json())
      .then((data) => setResult(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong"))
      .finally(() => setLoading(false));
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-dark via-primary to-primary-light text-white py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 tracking-tight">
            Navigate SD Permits
            <br />
            <span className="text-blue-200">with Confidence</span>
          </h1>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto">
            Describe your project in plain English and get a complete permit
            roadmap. Powered by live Accela &amp; Socrata APIs and San Diego
            Municipal Code.
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="max-w-3xl mx-auto px-4 -mt-8">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow-lg border border-border p-6 space-y-4"
        >
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-foreground mb-2">
              Describe Your Project
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., I want to build an ADU in my backyard at 1234 Elm St..."
              rows={3}
              className="w-full border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-foreground mb-2">
              Property Address <span className="text-muted font-normal">(optional)</span>
            </label>
            <input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g., 1234 Elm St, San Diego, CA"
              className="w-full border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setMode("detailed")}
              className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                mode === "detailed"
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-muted border-border hover:border-primary"
              }`}
            >
              Detailed (with Q&amp;A)
            </button>
            <button
              type="button"
              onClick={() => setMode("quick")}
              className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                mode === "quick"
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-muted border-border hover:border-primary"
              }`}
            >
              Quick Roadmap
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || !description.trim()}
            className="w-full bg-primary text-white font-medium py-3 px-6 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="loading-dot" />
                <span className="loading-dot" />
                <span className="loading-dot" />
                <span className="ml-2">Analyzing your project...</span>
              </span>
            ) : mode === "detailed" ? (
              "Start Permit Assessment"
            ) : (
              "Get Quick Roadmap"
            )}
          </button>
        </form>

        {/* Quick Examples */}
        <div className="mt-6">
          <p className="text-sm text-muted mb-3 text-center">Try an example:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {examples.map((ex) => (
              <button
                key={ex}
                onClick={() => setDescription(ex)}
                className="text-xs bg-surface hover:bg-surface-hover border border-border rounded-full px-3 py-1.5 text-muted hover:text-foreground transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Error */}
      {error && (
        <section className="max-w-3xl mx-auto px-4 mt-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
        </section>
      )}

      {/* Q&A Phase */}
      {questions && (
        <section className="max-w-3xl mx-auto px-4 mt-8 animate-slide-up">
          <QuestionsForm
            data={questions}
            onSubmit={handleAnswersSubmit}
            onSkip={handleSkipQuestions}
            loading={loading}
          />
        </section>
      )}

      {/* Results */}
      {result && (
        <section className="max-w-3xl mx-auto px-4 mt-8 animate-slide-up">
          <PermitRoadmap data={result} projectDescription={description} />
        </section>
      )}

      {/* Features */}
      {!result && !questions && (
        <section className="max-w-5xl mx-auto px-4 mt-16">
          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              title="AI Permit Navigator"
              description="Describe your project and get a personalized roadmap with Q&A refinement for precise guidance."
              icon="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
            <FeatureCard
              title="Live Permit Search"
              description="Search City (Accela API) and County (Socrata API) permit databases with real-time data."
              icon="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
            <FeatureCard
              title="Municipal Code Lookup"
              description="Find building code sections, exemptions, height limits, parking requirements, and ADU regulations."
              icon="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </div>
        </section>
      )}
    </div>
  );
}

function FeatureCard({ title, description, icon }: { title: string; description: string; icon: string }) {
  return (
    <div className="bg-white border border-border rounded-xl p-6 hover:shadow-md transition-shadow">
      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
        <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <h3 className="font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted leading-relaxed">{description}</p>
    </div>
  );
}
