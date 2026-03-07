"use client";

import { useState } from "react";

interface Question {
  id: string;
  question: string;
  why: string;
  options?: string[];
}

interface QuestionsData {
  phase: string;
  project_summary: string;
  questions: Question[];
  preliminary_assessment: string;
}

export function QuestionsForm({
  data,
  onSubmit,
  onSkip,
  loading,
}: {
  data: QuestionsData;
  onSubmit: (answers: Record<string, string>) => void;
  onSkip: () => void;
  loading: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  function handleAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(answers);
  }

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = data.questions.length;

  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-blue-50 border-b border-blue-200 p-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-primary-dark">A few questions to refine your roadmap</h3>
            <p className="text-sm text-primary mt-1">{data.preliminary_assessment}</p>
          </div>
        </div>
      </div>

      {/* Questions */}
      <form onSubmit={handleSubmit} className="p-5 space-y-5">
        {data.questions.map((q, idx) => (
          <div key={q.id} className="animate-fade-in" style={{ animationDelay: `${idx * 100}ms` }}>
            <label className="block text-sm font-medium text-foreground mb-2">
              <span className="text-muted mr-1">{idx + 1}.</span> {q.question}
            </label>
            <p className="text-xs text-muted mb-2 ml-4">{q.why}</p>

            {q.options ? (
              <div className="flex flex-wrap gap-2 ml-4">
                {q.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleAnswer(q.id, opt)}
                    className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                      answers[q.id] === opt
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-foreground border-border hover:border-primary hover:text-primary"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <input
                type="text"
                value={answers[q.id] || ""}
                onChange={(e) => handleAnswer(q.id, e.target.value)}
                placeholder="Type your answer..."
                className="w-full ml-4 max-w-md border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            )}
          </div>
        ))}

        {/* Progress & Actions */}
        <div className="border-t border-border pt-4 flex items-center justify-between">
          <p className="text-xs text-muted">
            {answeredCount}/{totalQuestions} questions answered
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onSkip}
              className="text-sm text-muted hover:text-foreground px-4 py-2 transition-colors"
            >
              Skip &amp; get basic roadmap
            </button>
            <button
              type="submit"
              disabled={loading || answeredCount === 0}
              className="bg-primary text-white font-medium text-sm py-2 px-6 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="loading-dot" />
                  <span className="loading-dot" />
                  <span className="loading-dot" />
                  <span>Generating...</span>
                </span>
              ) : (
                "Generate Refined Roadmap"
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
