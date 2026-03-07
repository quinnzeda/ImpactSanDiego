"use client";

import { useState, useEffect } from "react";

interface CodeSection {
  section_id: string;
  title: string;
  chapter: string;
  summary: string;
  key_points: string[];
}

export default function CodePage() {
  const [query, setQuery] = useState("");
  const [sections, setSections] = useState<CodeSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Load all sections on mount
  useEffect(() => {
    fetch("/api/code")
      .then((res) => res.json())
      .then((data) => {
        setSections(data.sections || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      const res = await fetch(`/api/code?${params}`);
      const data = await res.json();
      setSections(data.sections || []);
    } catch {
      setSections([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <section className="bg-gradient-to-r from-primary to-primary-light text-white py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Municipal Code Lookup</h1>
          <p className="text-blue-100">
            Search San Diego&apos;s building code sections relevant to
            permitting
          </p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 -mt-6">
        <form
          onSubmit={handleSearch}
          className="bg-white rounded-xl shadow-lg border border-border p-6 flex gap-3"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search code sections (e.g., ADU, parking, height limits, exemptions)"
            className="flex-1 border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-white font-medium py-2 px-6 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 text-sm"
          >
            Search
          </button>
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                fetch("/api/code")
                  .then((res) => res.json())
                  .then((data) => setSections(data.sections || []));
              }}
              className="text-sm text-muted hover:text-foreground px-3"
            >
              Clear
            </button>
          )}
        </form>
      </section>

      <section className="max-w-4xl mx-auto px-4 mt-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="flex justify-center gap-1 mb-2">
              <span className="loading-dot" />
              <span className="loading-dot" />
              <span className="loading-dot" />
            </div>
            <p className="text-muted">Loading code sections...</p>
          </div>
        ) : sections.length === 0 ? (
          <div className="text-center py-12 text-muted">
            <p className="text-lg font-medium">No matching sections found</p>
            <p className="text-sm mt-1">Try different search terms</p>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            <p className="text-sm text-muted">{sections.length} sections found</p>
            {sections.map((section) => (
              <div
                key={section.section_id}
                className="bg-white border border-border rounded-xl overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpanded(
                      expanded === section.section_id
                        ? null
                        : section.section_id
                    )
                  }
                  className="w-full text-left p-5 hover:bg-surface-hover transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-primary/10 text-primary font-mono px-2 py-0.5 rounded">
                          {section.section_id}
                        </span>
                        <span className="text-xs text-muted">
                          {section.chapter}
                        </span>
                      </div>
                      <h3 className="font-semibold text-foreground">
                        {section.title}
                      </h3>
                      <p className="text-sm text-muted mt-1 line-clamp-2">
                        {section.summary}
                      </p>
                    </div>
                    <svg
                      className={`w-5 h-5 text-muted shrink-0 ml-4 transition-transform ${
                        expanded === section.section_id ? "rotate-180" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </button>

                {expanded === section.section_id && (
                  <div className="border-t border-border p-5 bg-surface animate-fade-in">
                    <h4 className="font-medium text-sm mb-3">Key Points</h4>
                    <ul className="space-y-2">
                      {section.key_points.map((point, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-foreground"
                        >
                          <svg
                            className="w-4 h-4 text-accent shrink-0 mt-0.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          {point}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 pt-3 border-t border-border">
                      <p className="text-xs text-muted">
                        Source: San Diego Municipal Code, {section.chapter}.
                        Visit{" "}
                        <a
                          href="https://docs.sandiego.gov/municode/"
                          className="text-primary hover:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          docs.sandiego.gov/municode
                        </a>{" "}
                        for the full text.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
