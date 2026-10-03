"use client";

import { format, parseISO } from "date-fns";
import Link from "next/link";
import { useState } from "react";
import { MonthCalendar, PercentBadge } from "@/components/attendance/status";
import { InvoiceStatus } from "@/components/fees/shared";
import { useCan, useSession } from "@/components/session-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { inr } from "@/lib/format";
import { useInvoices, useStudentAttendance } from "@/lib/queries";

/** Attendance and fees on a student's profile, for staff allowed to see them. */
export function StudentRecords({ studentId }: { studentId: string }) {
  const can = useCan();
  const me = useSession();
  const thisMonth = format(new Date(), "yyyy-MM");
  const [month, setMonth] = useState(thisMonth);
  const showAttendance = can("attendance.view") && me.modules.includes("attendance");
  const showFees = can("fees.view") && me.modules.includes("fees");
  const att = useStudentAttendance(studentId, month, showAttendance);
  const invoices = useInvoices({ page: 1, student_id: studentId, page_size: 10 }, showFees);
  if (!showAttendance && !showFees) return null;
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      {showAttendance && (
        <Card>
          <CardHeader>
            <CardTitle>Attendance</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              This month <PercentBadge value={att.data?.month_percent ?? null} /> · this year <PercentBadge value={att.data?.year_percent ?? null} />
            </CardDescription>
          </CardHeader>
          <CardContent>{att.data || !att.isLoading ? <MonthCalendar data={att.data} month={month} onMonthChange={setMonth} maxMonth={thisMonth} /> : <Skeleton className="h-72" />}</CardContent>
        </Card>
      )}
      {showFees && (
        <Card>
          <CardHeader>
            <CardTitle>Fees</CardTitle>
            <CardDescription>
              {invoices.data ? `${inr(invoices.data.data.reduce((n, i) => n + i.balance, 0))} outstanding` : "Loading…"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!invoices.data ? <Skeleton className="h-48" /> : invoices.data.data.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No invoices yet.</p> : (
              <ul className="divide-y">
                {invoices.data.data.map((i) => (
                  <li key={i.id}>
                    <Link href={`/fees/invoices/${i.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{i.term}</span>
                        <span className="block text-xs text-muted-foreground">Due {format(parseISO(i.due_date), "d MMM yyyy")} · {i.invoice_no}</span>
                      </span>
                      <span className="text-right">
                        <span className="block text-sm font-semibold tabular">{inr(i.balance > 0 ? i.balance : i.total - i.discount)}</span>
                        <InvoiceStatus inv={i} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
