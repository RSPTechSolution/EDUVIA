---
name: schoolerp-web-phase-05-finance-dashboard
description: >
  Web Phase 5 — Finance module: fee structure builder, invoice list with
  collection workflow, payment gateway integration UI, PDF receipt download,
  financial analytics dashboard, expense ledger, Tally export, and
  fee defaulter management with bulk reminder.
---

# Web Phase 5 — Finance & Fee Management
## Recharts · React Query · PDF Preview

---

## Fee Structure Builder `/fees/structure`

```tsx
// Matrix layout: rows = fee categories, columns = classes
// Each cell is an editable amount field
// "Add Category" button → inline row append
// "Add Class" button → column append
// Save → POST all changes in one batch

<div className="overflow-x-auto rounded-xl border border-border">
  <table className="w-full text-sm">
    <thead>
      <tr className="border-b bg-muted/50">
        <th className="w-48 px-4 py-3 text-left font-semibold">Fee Category</th>
        {classes.map(cls => (
          <th key={cls.id} className="min-w-[140px] px-4 py-3 text-center font-semibold">
            {cls.name}
          </th>
        ))}
        <th className="w-10" />  {/* delete row action */}
      </tr>
    </thead>
    <tbody>
      {categories.map((cat, ri) => (
        <tr key={cat.id} className="border-b transition-colors hover:bg-muted/20">
          <td className="px-4 py-2.5">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" aria-label="Drag to reorder" />
              <Input value={cat.name} onChange={...} className="h-8 border-0 px-0 font-medium focus-visible:ring-0" />
            </div>
          </td>
          {classes.map(cls => (
            <td key={cls.id} className="px-4 py-2.5 text-center">
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">₹</span>
                <Input
                  type="number" min="0" className="pl-6 h-8 text-right tabular-nums"
                  value={structure[cat.id]?.[cls.id]?.amount ?? ''}
                  onChange={(e) => updateAmount(cat.id, cls.id, e.target.value)}
                  aria-label={`${cat.name} fee for ${cls.name}`}
                />
              </div>
            </td>
          ))}
          <td className="px-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => deleteCategory(cat.id)} aria-label={`Delete ${cat.name} category`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

---

## Fee Collection Page `/fees`

### Invoice List & KPI Bar

```tsx
// KPI row: Total Outstanding / Collected Today / Collected This Month / Collection Rate %
<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
  <StatCard title="Outstanding" value={stats.outstanding} prefix="₹" icon={AlertCircle} iconColor="text-destructive" />
  <StatCard title="Collected Today" value={stats.today} prefix="₹" icon={TrendingUp} iconColor="text-success" />
  <StatCard title="This Month" value={stats.month} prefix="₹" icon={Calendar} iconColor="text-primary" />
  <StatCard title="Collection Rate" value={stats.rate} suffix="%" icon={PieChart} iconColor="text-info" />
</div>

// Invoice DataTable columns
const columns = [
  { id: 'student', header: 'Student', cell: StudentCell },
  { accessorKey: 'invoice_no', header: 'Invoice No.',
    cell: ({ getValue }) => <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{getValue()}</code> },
  { accessorKey: 'class_name', header: 'Class' },
  { id: 'amount', header: 'Total', cell: CurrencyCell },
  { id: 'balance', header: 'Balance', cell: ({ row }) =>
      <span className={cn('font-semibold tabular-nums', row.original.balance > 0 && 'text-destructive')}>
        ₹{row.original.balance.toLocaleString('en-IN')}
      </span>
  },
  { accessorKey: 'due_date', header: 'Due Date', cell: DueDateCell },
  { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusBadge status={getValue()} /> },
  { id: 'actions', cell: InvoiceActionsMenu },   // Collect, View, Send Reminder, Download PDF
];
```

### Collect Fee Dialog

```tsx
// Dialog: Invoice summary + Payment method selector + Amount input
<Dialog>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Collect Fee</DialogTitle>
      <DialogDescription>{student.name} — Invoice #{invoice.invoice_no}</DialogDescription>
    </DialogHeader>

    {/* Invoice breakdown */}
    <div className="rounded-lg bg-muted/50 p-4 space-y-2">
      {invoice.line_items.map(item => (
        <div key={item.id} className="flex justify-between text-sm">
          <span className="text-muted-foreground">{item.description}</span>
          <span className="font-medium tabular-nums">₹{item.amount.toLocaleString('en-IN')}</span>
        </div>
      ))}
      <Separator />
      <div className="flex justify-between font-semibold">
        <span>Balance Due</span>
        <span className="text-destructive">₹{invoice.balance.toLocaleString('en-IN')}</span>
      </div>
    </div>

    {/* Payment method tabs */}
    <Tabs value={method} onValueChange={setMethod}>
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="cash">Cash</TabsTrigger>
        <TabsTrigger value="cheque">Cheque</TabsTrigger>
        <TabsTrigger value="upi">UPI</TabsTrigger>
        <TabsTrigger value="online">Online</TabsTrigger>
      </TabsList>
      <TabsContent value="cash">
        <AmountInput max={invoice.balance} onChange={setAmount} />
      </TabsContent>
      <TabsContent value="upi">
        {/* Show UPI QR code image from API */}
        <img src={`/api/fees/invoices/${invoice.id}/upi-qr`} alt="UPI QR Code" className="mx-auto rounded-xl" />
        <AmountInput max={invoice.balance} onChange={setAmount} />
      </TabsContent>
      <TabsContent value="online">
        <Button className="w-full" onClick={openRazorpay}>
          Pay with Razorpay
        </Button>
      </TabsContent>
    </Tabs>

    <DialogFooter>
      <Button onClick={collectFee} disabled={!amount || isCollecting}>
        {isCollecting ? <Spinner /> : 'Confirm Collection'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Financial Analytics `/fees/analytics`

```tsx
// Full analytics page with date range picker at top

// Row 1: Collection trend (12-month bar chart with target line)
// Row 2: Category breakdown donut + Collected vs Outstanding progress bars per class
// Row 3: Top defaulters table + Payment method distribution pie

// Collection Trend BarChart
<ComposedChart data={monthlyData}>
  <Bar dataKey="collected" name="Collected" fill="hsl(var(--chart-1))" radius={[4,4,0,0]} />
  <Line dataKey="target" name="Target" stroke="hsl(var(--warning))" strokeDasharray="4 4" dot={false} />
</ComposedChart>

// Category Donut
<PieChart>
  <Pie data={categoryData} dataKey="amount" cx="50%" cy="50%"
    innerRadius={60} outerRadius={90} paddingAngle={3}>
    {categoryData.map((_, i) => (
      <Cell key={i} fill={`hsl(var(--chart-${(i % 6) + 1}))`} />
    ))}
  </Pie>
  <Legend />
  <Tooltip formatter={(v) => `₹${Number(v).toLocaleString('en-IN')}`} />
</PieChart>
```

---

## Defaulter Management `/fees/defaulters`

```tsx
// DataTable: student name + class + outstanding amount + last payment date + days overdue
// Filters: class, minimum outstanding amount, date range
// Bulk actions: "Send SMS", "Send WhatsApp", "Send Email", "Export PDF"

// Bulk reminder with progress
<Dialog>
  <DialogContent>
    <DialogHeader><DialogTitle>Send Reminders</DialogTitle></DialogHeader>
    <p className="text-sm text-muted-foreground">
      Sending reminders to <strong>{selected.length}</strong> students via {channel}
    </p>
    {isSending && (
      <div className="space-y-2">
        <Progress value={(sent / selected.length) * 100} />
        <p className="text-xs text-muted-foreground text-center">{sent} / {selected.length} sent</p>
      </div>
    )}
  </DialogContent>
</Dialog>
```

---

## Antigravity Prompt for Web Phase 5

```
@file skills/master-plan/SKILL.md
@file skills/phase-web-05-finance-dashboard/SKILL.md

Build Web Phase 5 — Finance:
1. Fee structure builder: editable matrix table (categories × classes), inline edit,
   drag reorder, batch save, frequency selector per row
2. Fee invoice list: KPI bar, DataTable with balance column (red if due),
   status badge, collect dialog (cash/cheque/UPI QR/Razorpay tabs)
3. Collect fee dialog: invoice breakdown, payment method tabs, UPI QR image from API
4. PDF receipt download: fetch blob from API, open in new tab + download button
5. Financial analytics page: 12-month bar+line chart, category donut, class progress bars,
   payment method pie, all with date range picker
6. Fee defaulter page: DataTable, bulk SMS/WhatsApp/email reminder with progress dialog
7. Expense ledger: list + add form (category, amount, vendor, receipt upload)
8. Tally XML export: date range picker + download button
9. All monetary values: Indian locale formatting (₹ prefix, en-IN)
10. Run: pnpm build && pnpm test
```
