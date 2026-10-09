"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Send, Smartphone, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { useCan } from "@/components/session-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ApiError, api } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { useMessageLog, useMessagingStatus } from "@/lib/queries";
import { cn } from "@/lib/utils";

const PROVIDERS: Record<string, string> = { console: "Not connected (messages are only logged)", twilio: "Twilio", msg91: "MSG91", meta: "WhatsApp Cloud API" };

function MessagingPage() {
  const can = useCan();
  const manage = can("emails.manage");
  const qc = useQueryClient();
  const st = useMessagingStatus();
  const log = useMessageLog();
  const [chosen, setChosen] = useState<Record<string, string[]>>({});
  const [channel, setChannel] = useState<"sms" | "whatsapp">("sms");
  const [phone, setPhone] = useState("");
  useEffect(() => { if (st.data) setChosen(st.data.chosen); }, [st.data]);
  const save = useMutation({
    mutationFn: () => api("/messaging/settings", { method: "PUT", body: { events: chosen } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["messaging"] }); toast.success("Saved"); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not save"),
  });
  const test = useMutation({
    mutationFn: () => api<{ message: string }>("/messaging/test", { method: "POST", body: { channel, phone } }),
    onSuccess: ({ data }) => { qc.invalidateQueries({ queryKey: ["messaging", "log"] }); toast.success(data.message); },
    onError: (e) => toast.error(e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : "Could not send"),
  });
  if (st.isLoading || !st.data) return <Skeleton className="h-96 rounded-2xl" />;
  const s = st.data;
  const toggle = (ev: string, ch: string, on: boolean) => setChosen((x) => ({ ...x, [ev]: on ? [...(x[ev] ?? []), ch] : (x[ev] ?? []).filter((c) => c !== ch) }));
  const offline = s.sms_provider === "console" && s.whatsapp_provider === "console";
  return (
    <>
      <PageHeader title="SMS and WhatsApp" description="Text parents for the things that matter most. App notifications and email go out anyway." />
      {offline && (
        <Alert className="mb-5"><Terminal aria-hidden /><AlertDescription>
          No SMS or WhatsApp account is connected, so messages are recorded below but not sent. To send for real, set SMS_PROVIDER (twilio or msg91)
          or WHATSAPP_PROVIDER (meta) and their keys in the API&apos;s .env file.
        </AlertDescription></Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>When to text parents</CardTitle><CardDescription>SMS: {PROVIDERS[s.sms_provider] ?? s.sms_provider} · WhatsApp: {PROVIDERS[s.whatsapp_provider] ?? s.whatsapp_provider}</CardDescription></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground"><th scope="col" className="pb-2">Event</th><th scope="col" className="pb-2 text-center">SMS</th><th scope="col" className="pb-2 text-center">WhatsApp</th></tr></thead>
              <tbody>
                {Object.entries(s.events).map(([ev, label]) => (
                  <tr key={ev} className="border-t">
                    <td className="py-2.5">{label}</td>
                    {(["sms", "whatsapp"] as const).map((ch) => (
                      <td key={ch} className="py-2.5 text-center"><Switch checked={(chosen[ev] ?? []).includes(ch)} disabled={!manage} onCheckedChange={(v) => toggle(ev, ch, v)} aria-label={`${label} by ${ch === "sms" ? "SMS" : "WhatsApp"}`} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {manage && <Button className="mt-4" onClick={() => save.mutate()} loading={save.isPending}>Save</Button>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Send a test</CardTitle><CardDescription>Today: {s.today.sms ?? 0} SMS · {s.today.whatsapp ?? 0} WhatsApp</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2">
            <Select value={channel} onValueChange={(v) => setChannel(v as "sms" | "whatsapp")}>
              <SelectTrigger className="w-36" aria-label="Channel"><SelectValue>{channel === "sms" ? "SMS" : "WhatsApp"}</SelectValue></SelectTrigger>
              <SelectContent><SelectItem value="sms">SMS</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem></SelectContent>
            </Select>
            <Field label="Mobile number" className="w-48">{(a) => <Input {...a} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98140 10001" />}</Field>
            <Button variant="outline" disabled={!manage || phone.trim().length < 6} onClick={() => test.mutate()} loading={test.isPending}><Send aria-hidden />Send test</Button>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader><CardTitle>Recent messages</CardTitle></CardHeader>
        <CardContent>
          {!log.data?.length ? <p className="text-sm text-muted-foreground">Nothing sent yet.</p> : (
            <ul className="divide-y text-sm">
              {log.data.map((m) => (
                <li key={m.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 py-2">
                  {m.channel === "sms" ? <Smartphone className="mt-0.5 size-4 text-muted-foreground" aria-label="SMS" /> : <MessageCircle className="mt-0.5 size-4 text-success" aria-label="WhatsApp" />}
                  <span className="w-36 font-mono text-xs">{m.to}</span>
                  <span className="min-w-0 flex-1">{m.body}{m.error && <span className="block text-xs text-destructive">{m.error}</span>}</span>
                  <span className={cn("text-xs font-medium capitalize", m.status === "failed" ? "text-destructive" : m.status === "sent" ? "text-success" : "text-muted-foreground")}>{m.status}</span>
                  <span className="w-36 text-right text-xs text-muted-foreground">{formatDateTime(m.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export default function Page() {
  return <PermissionGate permission="emails.view"><MessagingPage /></PermissionGate>;
}
