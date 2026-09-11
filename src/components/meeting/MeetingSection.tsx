import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck, ExternalLink, Loader2, RefreshCw, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useDemandMeeting, useSyncDemandMeeting } from "@/hooks/useDemandMeeting";
import { useGoogleCalendarConnection } from "@/hooks/useGoogleCalendarConnection";
import {
  PARTICIPANT_STATUS_LABELS,
  SYNC_STATUS_LABELS,
  formatMeetingDate,
  formatMeetingTime,
  participantStatusTone,
} from "@/lib/meetingUtils";

export function MeetingSection({ demandId }: { demandId: string }) {
  const { data } = useDemandMeeting(demandId);
  const sync = useSyncDemandMeeting();
  const { connect } = useGoogleCalendarConnection();
  const verifiedFor = useRef<string | null>(null);

  const meetingId = data?.meeting?.id ?? null;
  const shouldVerify = data?.meeting?.sync_status === "synced" && !!data?.meeting?.google_event_id;

  // Read-only check that the event is still retrievable on Google (never creates one).
  useEffect(() => {
    if (!meetingId || !shouldVerify) return;
    if (verifiedFor.current === meetingId) return;
    verifiedFor.current = meetingId;
    sync.mutate({ meetingId, action: "verify" });
  }, [meetingId, shouldVerify]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data?.meeting) return null;
  const { meeting, participants } = data;
  const tz = meeting.timezone;

  const statusLabel = SYNC_STATUS_LABELS[meeting.sync_status] ?? meeting.sync_status;
  const isSynced = meeting.sync_status === "synced";
  const isFailed = meeting.sync_status === "failed" || meeting.sync_status === "reauth_required";

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <CalendarCheck className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Reunião</span>
      </div>

      <div className="text-sm">
        <p className="font-medium">{formatMeetingDate(meeting.starts_at, tz)}</p>
        <p className="text-muted-foreground">
          {formatMeetingTime(meeting.starts_at, tz)}–{formatMeetingTime(meeting.ends_at, tz)}
        </p>
      </div>

      {participants.length > 0 && (
        <div className="space-y-1.5 text-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Participantes</p>
          <ul className="space-y-1">
            {participants.map((p) => {
              const tone = participantStatusTone(p.calendar_sync_status);
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-foreground">{p.email}</span>
                  <span
                    className={
                      tone === "ok"
                        ? "text-xs text-emerald-600 dark:text-emerald-400"
                        : tone === "warn"
                        ? "text-xs text-amber-600 dark:text-amber-400"
                        : "text-xs text-muted-foreground"
                    }
                  >
                    {tone === "ok" ? "✓ " : tone === "warn" ? "⚠ " : "✉ "}
                    {PARTICIPANT_STATUS_LABELS[p.calendar_sync_status] ?? "Convite enviado"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Google Calendar</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {isSynced && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          {isFailed && <AlertTriangle className="h-4 w-4 text-amber-500" />}
          {meeting.sync_status === "syncing" && <Loader2 className="h-4 w-4 animate-spin" />}
          <span className="text-muted-foreground">{statusLabel}</span>
          {meeting.google_event_url && isSynced && (
            <a
              href={meeting.google_event_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Abrir evento <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {isSynced && meeting.google_organizer_email && (
          <div className="flex items-start gap-1.5 rounded-lg bg-muted/60 px-2.5 py-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Evento criado em <strong className="text-foreground">{meeting.google_organizer_email}</strong>.
              Se o Google Calendar disser que não encontrou o evento, você está navegando com outra conta Google —
              troque de conta no Google e abra o link novamente.
            </span>
          </div>
        )}


        {(isFailed || meeting.sync_status === "pending") && (
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => sync.mutate({ meetingId: meeting.id })}
            disabled={sync.isPending}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Tentar novamente
          </Button>
        )}

        {meeting.sync_status === "not_connected" && (
          <Button size="sm" variant="outline" className="h-8" onClick={() => connect.mutate()}>
            Conectar Google Calendar
          </Button>
        )}
      </div>

      {meeting.create_google_meet && (
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Google Meet</p>
          {meeting.google_meet_url ? (
            <Button size="sm" variant="outline" className="h-8" asChild>
              <a href={meeting.google_meet_url} target="_blank" rel="noreferrer">
                Acessar reunião <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          ) : (
            <Badge variant="secondary" className="rounded-full">Gerando link do Google Meet...</Badge>
          )}
        </div>
      )}
    </div>
  );
}
