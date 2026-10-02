---
name: schoolerp-web-phase-06-exams-communication
description: >
  Web Phase 6 — Examinations (offline exam setup, online CBT builder, question
  bank, item analysis charts, report cards) and Communication (SMS/WhatsApp
  broadcast, threaded chat UI, survey builder, engagement creatives, notice board).
---

# Web Phase 6 — Exams & Communication

---

## Examinations Module

### Online Exam Builder `/exams/online/[id]/builder`

```tsx
// Split layout: Left = question bank browser, Right = paper canvas

// Left panel: Question Bank
// - Search + filter (subject/type/difficulty)
// - Drag questions to right panel
// - Create question inline

// Right panel: Paper Canvas
// - Ordered question list with drag handle
// - Per-question: marks input, delete, preview
// - Blueprint summary: MCQ×10, Short×5, Long×2 | Total: 45 marks
// - Header: Duration input, Mode selector (Exam/Quiz/Practice)
// - Publish button → confirm dialog with scheduled time

// Question Card in Canvas
<div className="group relative rounded-lg border-2 border-border bg-card p-4
  hover:border-primary/30 transition-colors">
  <div className="flex items-start gap-3">
    <GripVertical className="h-5 w-5 mt-0.5 text-muted-foreground cursor-grab flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-1.5">
        <Badge variant="outline" className="text-[10px] uppercase">{question.type}</Badge>
        <Badge variant="outline" className={cn('text-[10px]',
          question.difficulty === 'easy' ? 'border-success/30 text-success' :
          question.difficulty === 'hard' ? 'border-destructive/30 text-destructive' :
          'border-warning/30 text-warning'
        )}>{question.difficulty}</Badge>
        {question.topic && <span className="text-xs text-muted-foreground">{question.topic}</span>}
      </div>
      <p className="text-sm text-foreground line-clamp-2">{question.content.text}</p>
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
      <div className="flex items-center gap-1">
        <Input type="number" value={question.marks} min={1} className="h-7 w-14 text-center text-xs"
          aria-label={`Marks for question ${i + 1}`} />
        <span className="text-xs text-muted-foreground">marks</span>
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100"
        onClick={() => removeQuestion(question.id)} aria-label="Remove question">
        <X className="h-4 w-4" />
      </Button>
    </div>
  </div>
</div>
```

### Item Analysis Dashboard

```tsx
// Per-question stats displayed as horizontal bar segments
// Correct % (green), Wrong % (red), Skip % (gray)
{questions.map((q, i) => (
  <div key={q.id} className="flex items-center gap-3">
    <span className="text-xs text-muted-foreground w-6 text-right tabular-nums">Q{i+1}</span>
    <div className="flex-1 flex h-5 overflow-hidden rounded-full bg-muted">
      <div className="bg-success h-full transition-all" style={{ width: `${q.correct_pct}%` }}
        title={`${q.correct_pct}% correct`} />
      <div className="bg-destructive h-full transition-all" style={{ width: `${q.wrong_pct}%` }}
        title={`${q.wrong_pct}% wrong`} />
      <div className="bg-muted-foreground/20 h-full transition-all" style={{ width: `${q.skip_pct}%` }}
        title={`${q.skip_pct}% skipped`} />
    </div>
    <span className="text-xs text-success w-10 text-right tabular-nums">{q.correct_pct}%</span>
  </div>
))}
```

---

## Communication Module

### Broadcast Message `/communication/broadcast`

```tsx
// Step 1: Audience selector — tabs: All / Class / Section / Individual
// Step 2: Channel selector — SMS / WhatsApp / Email / Push (multi-select)
// Step 3: Message composer
//   - SMS: plain text + char count + credit estimate
//   - WhatsApp: template picker + variable fields
//   - Email: rich text editor (Tiptap) + subject line
// Step 4: Preview + Send (with scheduled option)

// Channel cards
{channels.map(ch => (
  <button key={ch.id}
    onClick={() => toggleChannel(ch.id)}
    className={cn(
      'relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all',
      'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
      selectedChannels.includes(ch.id)
        ? 'border-primary bg-primary/5'
        : 'border-border bg-card hover:border-primary/40',
    )}
    aria-pressed={selectedChannels.includes(ch.id)}
  >
    <ch.icon className={cn('h-8 w-8', selectedChannels.includes(ch.id) ? 'text-primary' : 'text-muted-foreground')} />
    <span className="text-sm font-medium">{ch.label}</span>
    {selectedChannels.includes(ch.id) && (
      <CheckCircle2 className="absolute right-2 top-2 h-4 w-4 text-primary" aria-label="Selected" />
    )}
  </button>
))}
```

### Chat UI `/communication/chat`

```tsx
// Left: Thread list (search + filter + unread badge)
// Right: Thread view (message bubbles + file attachments + input)

// Message bubble
const MessageBubble = ({ message, isOwn }: MessageBubbleProps) => (
  <div className={cn('flex gap-2.5 max-w-[75%]', isOwn ? 'ml-auto flex-row-reverse' : '')}>
    {!isOwn && (
      <Avatar className="h-7 w-7 flex-shrink-0">
        <AvatarImage src={message.sender.photo} />
        <AvatarFallback className="text-[10px]">{message.sender.initials}</AvatarFallback>
      </Avatar>
    )}
    <div className={cn(
      'rounded-2xl px-3.5 py-2.5',
      isOwn ? 'rounded-br-sm bg-primary text-white' : 'rounded-bl-sm bg-card border border-border',
    )}>
      {!isOwn && <p className="text-[10px] font-semibold text-primary mb-1">{message.sender.name}</p>}
      <p className="text-sm leading-relaxed">{message.body}</p>
      <p className={cn('mt-1 text-[10px]', isOwn ? 'text-primary-foreground/60 text-right' : 'text-muted-foreground')}>
        {format(new Date(message.sent_at), 'h:mm a')}
        {isOwn && <span className="ml-1">{message.read_by.length > 1 ? '✓✓' : '✓'}</span>}
      </p>
    </div>
  </div>
);
```

### Survey Builder `/communication/surveys/[id]/build`

```tsx
// Drag-and-drop question builder
// Left panel: question type palette (drag to canvas)
// Right panel: question canvas + properties editor

// Question types available (icons):
// Star Rating, NPS (0-10), MCQ, Checkbox, Short text, Long text, Dropdown, Date, File upload

// Properties panel: question text, required toggle, options editor
```

---

## Antigravity Prompt for Web Phase 6

```
@file skills/master-plan/SKILL.md
@file skills/phase-web-06-exams-communication/SKILL.md

Build Web Phase 6 — Exams & Communication:
1. Exam list page: cards with status badges, date range, class scope, quick stats
2. Online exam builder: split layout (question bank browser + paper canvas),
   drag-drop questions, marks input, blueprint summary, publish dialog
3. Item analysis: horizontal bar chart (correct/wrong/skip) per question
4. Report card: PDF preview in iframe + download + bulk generate for class
5. Communication broadcast: audience selector tabs, multi-channel selector cards,
   SMS composer (char count), WhatsApp template picker, Email (Tiptap rich text)
6. Chat UI: thread list with unread badges + message bubble view with socket.io real-time
7. Survey builder: drag-drop question canvas with type palette
8. Notice board: card grid with pin, publish, schedule, and tag filtering
9. Run: pnpm build && pnpm test
```
