"use client";

import { useState, useRef, useEffect } from "react";
import { PermitRoadmap } from "./components/PermitRoadmap";
import { PermitVerdictCard } from "./components/PermitVerdictCard";
import { PersonalizedChecklist } from "./components/PersonalizedChecklist";
import { StatusTracker } from "./components/StatusTracker";
import { PropertyCard } from "./components/PropertyCard";
import { OptionsExplorer } from "./components/OptionsExplorer";
import { CostCalculator } from "./components/CostCalculator";
import { PermitPlan } from "./components/PermitPlan";

// ── Types ─────────────────────────────────────────────────────────────────────

type Situation = "planning" | "applying" | "waiting";
type Category = "adu" | "kitchen-bath" | "room-addition" | "solar" | "deck-fence";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Static data ───────────────────────────────────────────────────────────────

const SITUATIONS: { id: Situation; label: string; sub: string }[] = [
  { id: "planning", label: "Just starting to think about it", sub: "What's allowed, what it costs" },
  { id: "applying", label: "Ready to apply for a permit",     sub: "Get the exact checklist" },
  { id: "waiting",  label: "Waiting on a permit I filed",     sub: "Track status or decode a notice" },
];

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "adu",           label: "ADU" },
  { id: "kitchen-bath",  label: "Kitchen or Bath" },
  { id: "room-addition", label: "Room Addition" },
  { id: "solar",         label: "Solar" },
  { id: "deck-fence",    label: "Deck or Fence" },
];

const EXAMPLES: Record<string, Record<string, string[]> | string[]> = {
  planning: {
    adu:           ["Can I build a detached ADU on this lot?", "Can I convert my garage into an ADU here?", "What's the max ADU size allowed on this property?", "Do I need a coastal development permit for an ADU at this address?"],
    "kitchen-bath":  ["Do I need a permit to open up a wall at this address?", "What's involved in adding a full bathroom to this property?", "Which parts of a kitchen remodel need a permit here?"],
    "room-addition": ["What are the setback limits for a room addition on this lot?", "Can I add a second story to this property?", "Can I enclose my covered patio and turn it into living space here?"],
    solar:           ["Do I need a permit to install solar panels at this address?", "Does adding battery storage to my existing solar need a separate permit?", "How does the streamlined solar permit process work for this property?"],
    "deck-fence":    ["How high can I build a fence at this address without a permit?", "Do I need a permit to build a deck in my backyard here?", "Does a pergola or covered patio require a permit at this address?"],
  },
  applying: {
    adu:           ["What do I need to submit to get an ADU permit for this address?", "Do I need a licensed architect, or can I use design-build plans?", "How long is the city's plan check taking for ADUs right now?"],
    "kitchen-bath":  ["What's on the submittal checklist for a bathroom addition here?", "Does my contractor pull the permit or do I apply myself?", "What inspections will the city require during construction?"],
    "room-addition": ["What do I need to submit for a room addition permit at this address?", "Can I start any work while my application is in plan check?", "What's the permit fee for a room addition at this property?"],
    solar:           ["What do I need to submit for a solar permit at this address?", "Can my installer handle the permit application, or do I have to?", "How long does a solar permit take to approve for this property?"],
    "deck-fence":    ["What's on the checklist to permit a deck at this address?", "Do I need a site plan showing property lines to apply?", "What inspections will the city do on the deck after it's built?"],
  },
  waiting: ["My permit says PENDNG-PLANCK — what does that mean?", "I got a correction letter and I don't understand what they're asking for", "It's been 10 weeks since I submitted — is that normal?", "My permit is about to expire — can I get an extension?", "I got a fee invoice and I don't understand the line items"],
};

const SUBMIT_LABELS: Record<Situation, string> = {
  planning: "Check what's allowed",
  applying: "Build my permit checklist",
  waiting:  "Track my permit status",
};

const MODE_TAGS: Record<Situation, string> = {
  planning: "What's allowed",
  applying: "Permit checklist",
  waiting:  "Permit tracker",
};

function getFirstMessage(situation: Situation, addr: string): string {
  if (addr) {
    if (situation === "planning") return `Looking up ${addr} in the city's zoning records...`;
    if (situation === "applying") return `Pulling the permit checklist for ${addr}...`;
    return `Checking permit status for ${addr}...`;
  }
  if (situation === "planning") return "Got it. Let me pull up what San Diego's zoning rules say.";
  if (situation === "applying") return "Sure, let's get your checklist together. Give me a moment.";
  return "I'll look that up. Give me a moment to check the city's system.";
}

const CANVAS_CONTENT: Record<Situation, { title: string; desc: string }> = {
  planning: { title: "Zoning rules for your property",  desc: "What your lot allows, setback requirements, and what permits you'll need will show up here." },
  applying: { title: "Your permit checklist",           desc: "Exactly what to submit, who reviews it, how long it takes, and what it costs." },
  waiting:  { title: "Your permit status",              desc: "Current status, what each stage means, and what your next move is." },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildPropertySummary(data: Record<string, unknown>): string {
  const addr = (data.address as string)?.split(",")[0] || "your property";
  const community = data.community_plan_area as string | undefined;
  const zone = data.zone_code as string | undefined;
  const lot = data.lot_size_sqft as number | undefined;
  const isCoastal = data.is_coastal as boolean;
  const isHistoric = data.is_historic as boolean;
  const yearBuilt = data.year_built as number | undefined;

  let msg = `Found it! ${addr}`;
  if (community) msg += ` in ${community}`;
  msg += ".";

  const highlights: string[] = [];
  if (zone) highlights.push(`zoned ${zone}`);
  if (lot) highlights.push(`${lot.toLocaleString()} sq ft lot`);
  if (isCoastal) highlights.push("in the Coastal Zone");
  if (isHistoric || (yearBuilt && yearBuilt <= new Date().getFullYear() - 45))
    highlights.push(`built in ${yearBuilt} (may trigger historic review)`);

  if (highlights.length) msg += ` Key details: ${highlights.join(", ")}.`;
  return msg;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Home() {
  // Landing state
  const [activeSituation, setActiveSituation] = useState<Situation | null>(null);
  const [activeCategory,  setActiveCategory]  = useState<Category | null>(null);
  const [address,         setAddress]         = useState("");
  const [promptValue,     setPromptValue]     = useState("");
  const [examplesOpen,    setExamplesOpen]    = useState(false);
  const [activeExample,   setActiveExample]   = useState<string | null>(null);
  const [currentExamples, setCurrentExamples] = useState<string[]>([]);

  // App state
  const [appMode,    setAppMode]    = useState(false);
  const [modeTag,    setModeTag]    = useState("");
  const [messages,   setMessages]   = useState<ChatMessage[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [result,     setResult]     = useState<Record<string, unknown> | null>(null);
  const [propertyData, setPropertyData] = useState<Record<string, unknown> | null>(null);
  const [chatInput,  setChatInput]  = useState("");
  const [selectedAdu, setSelectedAdu] = useState<{ typeId: string; label: string } | null>(null);

  const promptRef      = useRef<HTMLTextAreaElement>(null);
  const chatInputRef   = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Landing interactions ───────────────────────────────────────────────────

  function handleSituationClick(sit: Situation) {
    if (activeSituation === sit) {
      setActiveSituation(null);
      setActiveCategory(null);
      setExamplesOpen(false);
      setCurrentExamples([]);
      return;
    }
    setActiveSituation(sit);
    setActiveCategory(null);
    if (sit === "waiting") {
      setCurrentExamples(EXAMPLES.waiting as string[]);
      setExamplesOpen(true);
    } else {
      setCurrentExamples([]);
      setExamplesOpen(false);
    }
  }

  function handleCategoryClick(cat: Category) {
    if (!activeSituation || activeSituation === "waiting") return;
    if (activeCategory === cat) {
      setActiveCategory(null);
      setExamplesOpen(false);
      setCurrentExamples([]);
      return;
    }
    setActiveCategory(cat);
    const catExamples = (EXAMPLES[activeSituation] as Record<string, string[]>)[cat] || [];
    setCurrentExamples(catExamples);
    setExamplesOpen(true);
  }

  function handleExampleClick(text: string) {
    setActiveExample(text);
    setPromptValue(text);
    setTimeout(() => {
      if (promptRef.current) autoResize(promptRef.current);
    }, 0);
    if (!address.trim()) {
      document.getElementById("addressInput")?.focus();
    } else {
      promptRef.current?.focus();
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!address.trim() && !promptValue.trim()) return;

    const situation = activeSituation || "planning";
    const userMsg = [address, promptValue].filter(Boolean).join(" — ");

    setModeTag(MODE_TAGS[situation]);
    setMessages([
      { role: "user",      content: userMsg },
      { role: "assistant", content: getFirstMessage(situation, address) },
    ]);
    setAppMode(true);
    setLoading(true);
    setResult(null);
    setPropertyData(null);

    try {
      // Fire both calls in parallel — property lookup resolves first (no AI)
      const propertyPromise = address.trim()
        ? fetch(`/api/property-lookup?address=${encodeURIComponent(address)}`)
            .then((r) => r.ok ? r.json() : null)
            .then((data) => {
              if (data) {
                setPropertyData(data);
                const summary = buildPropertySummary(data);
                if (summary) {
                  setMessages((prev) => [...prev, { role: "assistant", content: summary }]);
                }
              }
              return data;
            })
            .catch(() => null)
        : Promise.resolve(null);

      const navigatePromise = fetch("/api/navigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_description: promptValue || `${situation} permit inquiry`,
          property_address:    address || undefined,
          include_questions:   false,
          situation,
          category:            activeCategory || undefined,
        }),
      });

      const [, navRes] = await Promise.all([propertyPromise, navigatePromise]);

      if (!navRes.ok) throw new Error("Failed to get permit guidance");
      const data = await navRes.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong looking that up. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleChatSend() {
    const text = chatInput.trim();
    if (!text) return;
    setChatInput("");
    if (chatInputRef.current) autoResize(chatInputRef.current);

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const res = await fetch("/api/navigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_description: text,
          property_address:    address || undefined,
          situation:           activeSituation || undefined,
          category:            activeCategory || undefined,
        }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: "Got it — here's what I found." }]);
      setResult(data);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong. Try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleOptionSelect(typeId: string, label: string) {
    setSelectedAdu({ typeId, label });
    setMessages((prev) => [
      ...prev,
      { role: "user", content: `Let's go with the ${label} option.` },
      { role: "assistant", content: "Great choice. Now let's figure out your costs. I've set up a calculator on the right — drag the size slider to see how the square footage affects your permit fees, construction costs, and timeline." },
    ]);
    setResult({ canvas: "calculator" });
  }

  async function handleGetPlan(selectedType: string, size: number) {
    setLoading(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "Building your step-by-step permit plan..." }]);
    try {
      const res = await fetch("/api/navigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_description: `Build ${selectedType} ADU, ${size} sq ft at ${address}`,
          property_address: address || undefined,
          situation: "applying",
          category: activeCategory || "adu",
        }),
      });
      const data = await res.json();
      data.canvas = "plan";
      setMessages((prev) => [...prev, { role: "assistant", content: "Here's your complete step-by-step plan! Click any step to expand the details." }]);
      setResult(data);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong generating the plan." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setAppMode(false);
    setMessages([]);
    setResult(null);
    setPropertyData(null);
    setSelectedAdu(null);
    setLoading(false);
  }

  const submitLabel     = activeSituation ? SUBMIT_LABELS[activeSituation] : "Check what's allowed";
  const showChips       = activeSituation === "planning" || activeSituation === "applying";
  const canvasContent   = activeSituation ? CANVAS_CONTENT[activeSituation] : { title: "Your results will appear here", desc: "Property details, checklists, and cost estimates will appear here as we work through your project together." };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ══════════════════ LANDING ══════════════════ */}
      {!appMode && (
        <div className="min-h-dvh flex flex-col bg-stone-50">

          {/* Nav */}
          <nav className="flex items-center justify-between px-[clamp(1.5rem,6vw,4rem)] py-5 shrink-0">
            <a href="#" className="flex items-center gap-2.5 no-underline text-stone-900">
              <div className="w-[34px] h-[34px] bg-sage-500 rounded-[10px] flex items-center justify-center shrink-0">
                <HouseIcon />
              </div>
              <span className="font-serif text-[1.125rem] font-semibold tracking-[-0.01em]">Permit Buddy</span>
            </a>
            <span className="text-xs font-medium text-stone-600 bg-stone-100 border border-stone-200 px-3 py-1 rounded-full">
              San Diego
            </span>
          </nav>

          {/* Hero */}
          <main className="flex-1 flex flex-col items-center px-[clamp(1.25rem,5vw,3rem)] py-4 pb-10">
            <div className="w-full max-w-[700px] flex flex-col gap-7">

              {/* Headline */}
              <div className="flex flex-col gap-4">
                <h1 className="font-serif text-[clamp(2rem,4vw,2.875rem)] font-semibold leading-[1.12] tracking-[-0.025em] text-stone-900">
                  San Diego permit guidance<br />for residential projects.
                </h1>
                <p className="text-[clamp(0.9375rem,1.4vw,1rem)] leading-[1.7] text-stone-600">
                  Know what is allowed on your lot, what documents you need, and how your application is moving — in plain English, before delays cost you time and money.
                </p>
              </div>

              {/* Situation cards */}
              <div>
                <p className="text-[0.8125rem] font-semibold text-stone-500 tracking-[0.03em] uppercase mb-3">
                  Where are you with your project?
                </p>
                <div className="grid grid-cols-3 gap-2.5 max-sm:grid-cols-1">
                  {SITUATIONS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSituationClick(s.id)}
                      className={`flex flex-col gap-1.5 px-4 py-3 bg-white border-[1.5px] rounded-[14px] text-left transition-all duration-[0.15s] ${
                        activeSituation === s.id
                          ? "border-sage-500 bg-sage-50 shadow-[0_0_0_3px_oklch(58%_0.105_158_/_0.10)]"
                          : "border-stone-200 hover:border-sage-200 hover:bg-sage-50"
                      }`}
                    >
                      <span className="text-[0.9375rem] font-semibold text-stone-900 leading-[1.3]">{s.label}</span>
                      <span className="text-[0.75rem] text-stone-500 leading-[1.4]">{s.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Category chips */}
              {showChips && (
                <div className="flex flex-col gap-3 animate-fade-in">
                  <span className="text-[0.75rem] font-medium text-stone-500 tracking-[0.05em] uppercase">
                    {activeSituation === "applying" ? "What are you applying for?" : "What kind of project?"}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleCategoryClick(c.id)}
                        className={`text-[0.875rem] font-medium px-4 py-[0.4375rem] border-[1.5px] rounded-full leading-none select-none transition-all duration-[0.15s] ${
                          activeCategory === c.id
                            ? "bg-sage-500 border-sage-500 text-white"
                            : "bg-stone-100 border-stone-200 text-stone-700 hover:bg-sage-50 hover:border-sage-200 hover:text-sage-700"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input card */}
              <div className="flex flex-col gap-3 bg-white border-[1.5px] border-stone-200 rounded-[14px] p-[1.125rem] shadow-[0_2px_8px_oklch(22%_0.008_240_/_0.05)] transition-all duration-[0.18s] focus-within:border-sage-300 focus-within:shadow-[0_0_0_3px_oklch(58%_0.105_158_/_0.10),_0_2px_8px_oklch(22%_0.008_240_/_0.05)]">

                {/* Address */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.75rem] font-medium text-stone-500 tracking-[0.04em] uppercase" htmlFor="addressInput">
                    {activeSituation === "waiting" ? "Permit number or property address" : "Property address"}
                  </label>
                  <input
                    id="addressInput"
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") promptRef.current?.focus(); }}
                    placeholder={activeSituation === "waiting" ? "PDS2024-xxxxxx or 123 Main St, San Diego, CA" : "123 Main St, San Diego, CA"}
                    autoComplete="street-address"
                    className="w-full text-[0.9375rem] text-stone-900 bg-stone-50 border-[1.5px] border-stone-200 rounded-[10px] px-3.5 py-2.5 outline-none leading-[1.5] placeholder:text-stone-300 focus:border-sage-300 transition-colors duration-[0.15s]"
                  />
                </div>

                <div className="h-px bg-stone-100" />

                {/* Question */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.75rem] font-medium text-stone-500 tracking-[0.04em] uppercase" htmlFor="promptInput">
                    {activeSituation === "applying" ? "What are you applying for?" : activeSituation === "waiting" ? "What are you seeing?" : "What do you want to know?"}
                  </label>
                  <textarea
                    id="promptInput"
                    ref={promptRef}
                    value={promptValue}
                    rows={2}
                    onChange={(e) => { setPromptValue(e.target.value); autoResize(e.target); }}
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(); }}
                    placeholder="Type your question, or pick one below..."
                    className="w-full min-h-[64px] max-h-[180px] resize-none text-[0.9375rem] text-stone-900 bg-stone-50 border-[1.5px] border-stone-200 rounded-[10px] px-3.5 py-2.5 outline-none leading-[1.55] placeholder:text-stone-300 focus:border-sage-300 transition-colors duration-[0.15s] overflow-y-auto"
                  />

                  {/* Example prompts (accordion) */}
                  <div
                    className="grid transition-[grid-template-rows] duration-[0.32s] ease-[cubic-bezier(0.16,1,0.3,1)]"
                    style={{ gridTemplateRows: examplesOpen ? "1fr" : "0fr" }}
                  >
                    <div className="overflow-hidden">
                      <span className="block text-[0.75rem] font-medium text-stone-500 tracking-[0.04em] uppercase pt-3 mb-2">
                        Not sure where to start? Try one of these:
                      </span>
                      <div className="grid grid-cols-2 gap-2 pb-1 max-sm:grid-cols-1">
                        {currentExamples.map((ex, i) => (
                          <button
                            key={ex}
                            type="button"
                            onClick={() => handleExampleClick(ex)}
                            style={{ animationDelay: `${i * 45}ms` }}
                            className={`inline-flex items-start text-[0.8125rem] font-medium text-left px-3 py-[0.375rem] border-[1.5px] rounded-full leading-[1.3] transition-all duration-[0.15s] animate-fade-in ${
                              activeExample === ex
                                ? "bg-sage-100 border-sage-400 text-sage-700"
                                : "bg-stone-100 border-stone-200 text-stone-700 hover:bg-sage-50 hover:border-sage-200 hover:text-sage-700"
                            }`}
                          >
                            {ex}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="flex flex-col gap-2 -mt-1.5">
                <span className="text-[0.75rem] text-stone-300 text-center">⌘ + Return to submit</span>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="flex items-center justify-center gap-2 w-full text-[1.0625rem] font-semibold text-white bg-sage-500 border-none rounded-[10px] py-4 px-6 tracking-[-0.01em] transition-all duration-[0.16s] hover:bg-sage-600 hover:-translate-y-px active:translate-y-0 cursor-pointer"
                >
                  <span>{submitLabel}</span>
                  <ArrowRight />
                </button>
              </div>

            </div>
          </main>
        </div>
      )}

      {/* ══════════════════ APP STATE ══════════════════ */}
      {appMode && (
        <div className="min-h-dvh flex flex-col">

          {/* App nav */}
          <nav className="flex items-center justify-between px-6 py-[0.875rem] border-b border-stone-200 bg-white shrink-0">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1.5 text-[0.875rem] font-medium text-stone-600 bg-transparent border-none cursor-pointer py-1 hover:text-stone-900 transition-colors duration-[0.15s]"
            >
              <ArrowLeft />
              Back
            </button>

            <a href="#" className="flex items-center gap-2 no-underline text-stone-900">
              <div className="w-7 h-7 bg-sage-500 rounded-[10px] flex items-center justify-center shrink-0">
                <HouseIconSm />
              </div>
              <span className="font-serif text-base font-semibold tracking-[-0.01em]">Permit Buddy</span>
            </a>

            <span className="text-[0.75rem] font-medium text-sage-700 bg-sage-100 border border-sage-200 px-3 py-1 rounded-full">
              {modeTag}
            </span>
          </nav>

          {/* Split layout */}
          <div className="flex-1 grid grid-cols-[400px_1fr] overflow-hidden max-sm:grid-cols-1 max-sm:grid-rows-[1fr_1fr]">

            {/* Chat panel */}
            <div className="flex flex-col border-r border-stone-200 bg-white overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    <div
                      className={`text-[0.9375rem] leading-[1.55] px-4 py-3 rounded-[14px] max-w-[88%] ${
                        msg.role === "user"
                          ? "bg-sage-500 text-white rounded-br-[4px]"
                          : "bg-stone-100 text-stone-900 rounded-bl-[4px]"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex flex-col items-start">
                    <div className="bg-stone-100 text-stone-400 px-4 py-3 rounded-[14px] rounded-bl-[4px] text-[0.9375rem]">
                      Thinking…
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat input */}
              <div className="flex gap-2.5 items-end p-4 border-t border-stone-200">
                <textarea
                  ref={chatInputRef}
                  value={chatInput}
                  rows={1}
                  onChange={(e) => { setChatInput(e.target.value); autoResize(e.target); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChatSend(); }
                  }}
                  placeholder="Ask a follow-up..."
                  className="flex-1 text-[0.9375rem] text-stone-900 bg-stone-50 border-[1.5px] border-stone-200 rounded-[10px] px-3.5 py-2.5 resize-none outline-none min-h-[44px] max-h-[120px] leading-[1.5] placeholder:text-stone-300 focus:border-sage-300 transition-colors duration-[0.15s]"
                />
                <button
                  type="button"
                  onClick={handleChatSend}
                  disabled={loading}
                  className="w-10 h-10 bg-sage-500 border-none rounded-[6px] flex items-center justify-center shrink-0 cursor-pointer hover:bg-sage-600 transition-colors duration-[0.15s] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <SendIcon />
                </button>
              </div>
            </div>

            {/* Canvas panel */}
            <div className="bg-stone-50 overflow-y-auto flex flex-col">
              {/* Property card appears early from separate lookup */}
              {propertyData && !result && (
                <div className="p-6 flex flex-col gap-4">
                  <PropertyCard property={propertyData} showCta />
                  {loading && (
                    <div className="flex items-center justify-center py-8">
                      <CanvasLoading />
                    </div>
                  )}
                </div>
              )}
              {!propertyData && loading && (
                <div className="flex-1 flex items-center justify-center p-8">
                  <CanvasLoading />
                </div>
              )}
              {result && (
                <div className="p-6 flex flex-col gap-4">
                  <CanvasRouter
                    result={result}
                    activeSituation={activeSituation}
                    projectDescription={promptValue || address}
                    address={address}
                    onSelect={handleOptionSelect}
                    onGetPlan={handleGetPlan}
                    selectedAdu={selectedAdu}
                    earlyPropertyData={propertyData}
                  />
                </div>
              )}
              {!loading && !result && !propertyData && (
                <div className="flex-1 flex items-center justify-center p-8">
                  <CanvasEmpty title={canvasContent.title} desc={canvasContent.desc} />
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </>
  );
}

// ── CanvasRouter ───────────────────────────────────────────────────────────────

type Reliability = { source: "live" | "ai" | "fallback"; notes: string[] };

function CanvasRouter({
  result,
  activeSituation,
  projectDescription,
  address,
  onSelect,
  onGetPlan,
  selectedAdu,
  earlyPropertyData,
}: {
  result: Record<string, unknown>;
  activeSituation: Situation | null;
  projectDescription: string;
  address: string;
  onSelect?: (typeId: string, label: string) => void;
  onGetPlan?: (selectedType: string, size: number) => void;
  selectedAdu?: { typeId: string; label: string } | null;
  earlyPropertyData?: Record<string, unknown> | null;
}) {
  const canvas = result.canvas as string | undefined;
  const reliability = result.reliability as Reliability | undefined;

  // Use property from result (merged with real data) or fall back to early lookup
  const propertySource =
    (result.property as Record<string, unknown> | undefined) ??
    (earlyPropertyData as Record<string, unknown> | undefined);
  const hasProperty = propertySource != null;

  const effectiveCanvas =
    canvas ||
    (activeSituation === "planning"
      ? "verdict"
      : activeSituation === "applying"
      ? "checklist"
      : activeSituation === "waiting"
      ? "status"
      : "roadmap");

  let primaryCard: React.ReactNode;

  switch (effectiveCanvas) {
    case "verdict":
      primaryCard = (
        <>
          <PermitVerdictCard
            verdict={result.verdict as Record<string, unknown> | undefined}
            estimated_timeline={result.estimated_timeline as string | undefined}
            estimated_cost_range={result.estimated_cost_range as string | undefined}
            reliability={reliability}
          />
          {result.options && (
            <OptionsExplorer
              options={result.options as Record<string, unknown> | undefined}
              reliability={reliability}
              onSelect={onSelect}
            />
          )}
        </>
      );
      break;
    case "checklist":
      primaryCard = (
        <PersonalizedChecklist
          checklist={result.checklist as Record<string, unknown> | undefined}
          reliability={reliability}
          projectDescription={projectDescription}
        />
      );
      break;
    case "status":
      primaryCard = (
        <StatusTracker
          status={result.status as Record<string, unknown> | undefined}
          reliability={reliability}
          address={address}
        />
      );
      break;
    case "options":
      primaryCard = (
        <OptionsExplorer
          options={result.options as Record<string, unknown> | undefined}
          reliability={reliability}
          onSelect={onSelect}
        />
      );
      break;
    case "calculator":
      primaryCard = selectedAdu && onGetPlan ? (
        <CostCalculator
          selectedType={selectedAdu.typeId}
          selectedLabel={selectedAdu.label}
          property={propertySource}
          onGetPlan={onGetPlan}
        />
      ) : null;
      break;
    case "plan":
      primaryCard = (
        <PermitPlan
          phases={result.phases as Array<{ label: string; color: "green" | "violet" | "blue" | "gray"; steps: Array<{ title: string; subtitle?: string; detail?: string }> }> | undefined}
          process_steps={result.process_steps as string[] | undefined}
          checklist={result.checklist as Record<string, unknown> | undefined}
          estimated_timeline={result.estimated_timeline as string | undefined}
          estimated_cost_range={result.estimated_cost_range as string | undefined}
        />
      );
      break;
    default:
      primaryCard = <PermitRoadmap data={result} projectDescription={projectDescription} />;
  }

  return <>{primaryCard}</>;
}

// ── Small components ──────────────────────────────────────────────────────────

function CanvasLoading() {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="w-12 h-12 bg-stone-100 rounded-[14px] flex items-center justify-center">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="oklch(62% 0.016 75)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="animate-spin" style={{ animationDuration: "1.8s" }}>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      </div>
      <div>
        <p className="font-serif text-[1.125rem] font-semibold text-stone-900">Looking that up...</p>
        <p className="text-[0.9375rem] text-stone-600 mt-1.5 leading-[1.6]">Pulling city data for your address</p>
      </div>
    </div>
  );
}

function CanvasEmpty({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="text-center max-w-[300px]">
      <div className="w-[52px] h-[52px] bg-stone-100 rounded-[14px] flex items-center justify-center mx-auto mb-5">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="oklch(50% 0.014 75)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </svg>
      </div>
      <h3 className="font-serif text-[1.125rem] font-semibold text-stone-900 mb-2">{title}</h3>
      <p className="text-[0.9375rem] text-stone-600 leading-[1.6]">{desc}</p>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function HouseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function HouseIconSm() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function ArrowLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
