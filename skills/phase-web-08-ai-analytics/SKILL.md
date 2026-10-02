---
name: schoolerp-web-phase-08-ai-analytics
description: >
  Web Phase 8 — AI assistant chat interface with streaming SSE, analytics
  dashboard with interactive Recharts, custom report builder with drag-drop
  columns, export to PDF/Excel, and Super Admin SaaS panel (school list,
  MRR dashboard, provisioning wizard, branding editor, backup config).
---

# Web Phase 8 — AI, Analytics & Super Admin
## Recharts · LangChain SSE · TanStack Table · Next.js 15

---

## AI Assistant `/ai`

```tsx
// Full-height chat interface — sidebar thread list + main chat area
// Suggestion chips on empty state
// Streaming token-by-token response via fetch SSE

'use client';
import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SUGGESTIONS = [
  { icon: '📊', text: "What's today's attendance rate?" },
  { icon: '💰', text: 'Which students have fees outstanding above ₹5,000?' },
  { icon: '🏆', text: 'Who are the top 5 performers in the last exam?' },
  { icon: '🚌', text: 'How many buses are currently active?' },
  { icon: '📚', text: 'Which books are overdue in the library?' },
  { icon: '👥', text: 'How many students were admitted this month?' },
];

export function AiChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;
    setInput('');
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() };
    const asstMsg: Message = { id: (Date.now()+1).toString(), role: 'assistant', content: '', timestamp: new Date() };
    setMessages(prev => [...prev, userMsg, asstMsg]);
    setIsStreaming(true);

    // SSE streaming fetch
    const res = await fetch('/api/proxy/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
      body: JSON.stringify({ message: text }),
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
          const chunk = line.slice(6);
          setMessages(prev => prev.map(m =>
            m.id === asstMsg.id ? { ...m, content: m.content + chunk } : m
          ));
        }
      }
    }
    setIsStreaming(false);
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <BrainCircuit className="h-8 w-8 text-primary" aria-hidden />
            </div>
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold">AI Assistant</h2>
              <p className="text-muted-foreground mt-1">Ask anything about your school data</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 max-w-2xl w-full">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => sendMessage(s.text)}
                  className="flex items-start gap-2 rounded-xl border border-border bg-card p-3 text-left text-sm
                    transition-all hover:border-primary/40 hover:shadow-card focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="text-lg flex-shrink-0" aria-hidden>{s.icon}</span>
                  <span className="text-muted-foreground leading-snug">{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}
                >
                  <div className={cn(
                    'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm',
                    msg.role === 'user' ? 'bg-primary text-white' : 'bg-muted border border-border',
                  )}>
                    {msg.role === 'user' ? <User className="h-4 w-4" /> : '🤖'}
                  </div>
                  <div className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'rounded-tr-sm bg-primary text-white'
                      : 'rounded-tl-sm bg-card border border-border text-foreground',
                  )}>
                    {msg.content || (isStreaming && msg.role === 'assistant' && (
                      <div className="flex gap-1 items-center h-5">
                        {[0,1,2].map(i => (
                          <div key={i} className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </div>
                    ))}
                    {msg.content}
                    <p className={cn('mt-1.5 text-[10px]',
                      msg.role === 'user' ? 'text-white/60 text-right' : 'text-muted-foreground',
                    )}>
                      {format(msg.timestamp, 'h:mm a')}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border bg-card/80 px-4 py-4 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-3 rounded-2xl border-2 border-border bg-background
            px-4 py-3 transition-colors focus-within:border-primary/50">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }}}
              placeholder="Ask about attendance, fees, students, exams..."
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground
                focus:outline-none min-h-[24px] max-h-32"
              aria-label="Message input"
              aria-multiline="true"
            />
            <Button size="sm" onClick={() => sendMessage(input)}
              disabled={!input.trim() || isStreaming}
              className="h-8 w-8 rounded-xl p-0 flex-shrink-0"
              aria-label="Send message">
              {isStreaming
                ? <Square className="h-3.5 w-3.5" aria-hidden />
                : <SendHorizontal className="h-3.5 w-3.5" aria-hidden />
              }
            </Button>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            AI answers are grounded in your school's actual data. Press Enter to send, Shift+Enter for new line.
          </p>
        </div>
      </div>
    </div>
  );
}
```

---

## Analytics Dashboard `/analytics`

```tsx
// Full analytics page — date range picker at top affects all charts

// Section 1: Overview row (4 stat cards)
// Section 2: Attendance + Fees side-by-side charts
// Section 3: Student distribution + Exam performance
// Section 4: Custom report builder

// Attendance Trend — AreaChart with gradient
// Fee Collection — Stacked BarChart (12 months)
// Student by Class — Horizontal BarChart
// Exam Pass Rate — Gauge-style RadialBarChart
// Gender Distribution — DonutChart

const AnalyticsPage = () => (
  <div className="space-y-6">
    <PageHeader title="Analytics" description="School performance insights"
      actions={<DateRangePicker value={range} onChange={setRange} presets={['7d','30d','3m','6m','1y']} />} />

    {/* Overview KPIs */}
    <motion.div variants={statCardGrid} initial="initial" animate="animate"
      className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {kpis.map((kpi, i) => <motion.div key={i} variants={staggerItem}><StatCard {...kpi} /></motion.div>)}
    </motion.div>

    {/* Charts row 1 */}
    <div className="grid gap-4 lg:grid-cols-2">
      <AttendanceTrendChart data={analytics.attendance_trend} />
      <FeeCollectionChart data={analytics.fee_trend} />
    </div>

    {/* Charts row 2 */}
    <div className="grid gap-4 lg:grid-cols-3">
      <StudentDistributionChart data={analytics.student_by_class} className="lg:col-span-2" />
      <GenderDistributionChart data={analytics.gender} />
    </div>

    {/* Custom Report Builder */}
    <CustomReportBuilder />
  </div>
);
```

---

## Super Admin Panel `/super-admin`

```tsx
// Separate layout — no school sidebar, super admin branding

// Dashboard: platform-wide KPIs + charts
// School provisioning wizard
// School list with management actions
// Plan management

// Platform KPIs
const PLATFORM_KPIS = [
  { title: 'Total Schools',   value: platform.total_schools,   icon: Building2 },
  { title: 'Total Students',  value: platform.total_students,  icon: Users },
  { title: 'Monthly Revenue', value: platform.mrr, prefix: '₹', icon: TrendingUp },
  { title: 'Annual Revenue',  value: platform.arr, prefix: '₹', icon: BarChart3 },
];

// School Provisioning Wizard — 4 steps in a Dialog
const WIZARD_STEPS = ['School Info', 'Plan Selection', 'Admin Setup', 'Confirm'];

// Step 1: School name, slug (auto-generated + editable), timezone, currency, language
// Step 2: Plan card picker (visual cards showing included modules + price)
// Step 3: Admin email, temporary password (auto-generate button)
// Step 4: Summary + "Provision School" button with loading state

// Plan picker cards
{plans.map(plan => (
  <button key={plan.id}
    onClick={() => setSelectedPlan(plan.id)}
    className={cn(
      'relative flex flex-col rounded-xl border-2 p-5 text-left transition-all',
      selectedPlan === plan.id
        ? 'border-primary bg-primary/5 shadow-md'
        : 'border-border bg-card hover:border-primary/40',
    )}
    aria-pressed={selectedPlan === plan.id}
  >
    {plan.is_popular && (
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-white">
        Most Popular
      </span>
    )}
    <p className="font-display text-lg font-bold">{plan.name}</p>
    <div className="mt-1 flex items-baseline gap-1">
      <span className="text-2xl font-bold">₹{plan.price.toLocaleString('en-IN')}</span>
      <span className="text-sm text-muted-foreground">/{plan.interval}</span>
    </div>
    <ul className="mt-3 space-y-1.5">
      {plan.modules.slice(0, 5).map(m => (
        <li key={m} className="flex items-center gap-2 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5 text-success flex-shrink-0" aria-hidden />
          {m.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
        </li>
      ))}
      {plan.modules.length > 5 && (
        <li className="text-xs text-primary">+{plan.modules.length - 5} more modules</li>
      )}
    </ul>
  </button>
))}

// School Branding Editor
// Color pickers (primary + accent), logo upload, font picker, custom CSS textarea
// Live preview panel showing how the dashboard will look with the selected branding
```

---

## Antigravity Prompt for Web Phase 8

```
@file skills/master-plan/SKILL.md
@file skills/phase-web-08-ai-analytics/SKILL.md

Build Web Phase 8 — AI, Analytics & Super Admin:
1. AI chat page: full-height layout, SSE streaming via fetch ReadableStream,
   animated typing dots during streaming, suggestion chips on empty state,
   message bubbles (user=right blue, assistant=left card), Enter to send
2. Analytics page: date range picker, 4 KPI cards, AreaChart attendance,
   StackedBarChart fee collection (12 months), StudentByClass horizontal bar,
   gender donut, exam pass rate radial bar — all theme-aware colors
3. Custom report builder: drag-drop column selector, filter builder (field/op/value rows),
   sort picker, preview table (first 10 rows), export to Excel + PDF buttons
4. Super Admin separate layout (no school sidebar)
5. Super Admin dashboard: platform KPIs (total schools/students/MRR/ARR),
   MRR trend line chart (12 months), plan distribution donut, new schools bar chart
6. School provisioning wizard: 4-step Dialog (school info / plan picker / admin setup / confirm)
7. Plan management: plan cards with module checklist, CRUD, drag to reorder
8. School branding editor: color pickers + logo upload + live preview panel
9. Backup config UI: provider selector (R2/B2/Telegram), credential form, test button,
   last backup status chip, manual trigger button
10. Run: pnpm build && pnpm test
```
