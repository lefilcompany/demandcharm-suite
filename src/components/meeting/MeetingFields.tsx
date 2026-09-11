import { AlertTriangle, CalendarCheck, CheckCircle2, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGoogleCalendarConnection } from "@/hooks/useGoogleCalendarConnection";
import { DURATION_OPTIONS, MeetingFormValue } from "@/lib/meetingUtils";

interface MeetingFieldsProps {
  value: MeetingFormValue;
  onChange: (value: MeetingFormValue) => void;
  participantNames?: string[];
  requireCurrentUserConnection?: boolean;
}

export function MeetingFields({
  value,
  onChange,
  participantNames = [],
  requireCurrentUserConnection = true,
}: MeetingFieldsProps) {
  const { connection, isLoading, connect } = useGoogleCalendarConnection();
  const update = (partial: Partial<MeetingFormValue>) => onChange({ ...value, ...partial });

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex items-center gap-2">
        <CalendarCheck className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Informações da reunião</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="meeting-time">Horário *</Label>
          <Input id="meeting-time" type="time" className="h-8" value={value.time} onChange={(event) => update({ time: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Duração *</Label>
          <div className="flex gap-2">
            <Select value={value.duration} onValueChange={(duration) => update({ duration })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {value.duration === "custom" && (
              <Input type="number" min={5} step={5} className="h-8 w-24" value={value.customMinutes} onChange={(event) => update({ customMinutes: Number(event.target.value) })} aria-label="Duração personalizada em minutos" />
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="create-meet" checked={value.createGoogleMeet} onCheckedChange={(checked) => update({ createGoogleMeet: checked === true })} />
        <Label htmlFor="create-meet" className="cursor-pointer font-normal">Criar link do Google Meet</Label>
      </div>

      <div className="rounded-md border border-border bg-background/60 p-3 text-xs text-muted-foreground">
        <div className="mb-1.5 flex items-center gap-2 font-medium text-foreground">
          <Users className="h-3.5 w-3.5" /> Participantes automáticos
        </div>
        {participantNames.length > 0 ? participantNames.join(", ") : "Solicitante, responsável e acompanhantes da demanda."}
      </div>

      {requireCurrentUserConnection && (
        isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Verificando Google Calendar...</div>
        ) : connection?.connected ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Google Calendar conectado.</div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-background/60 p-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            <span>Conecte seu Google Calendar para criar esta reunião.</span>
            <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => connect.mutate()} disabled={connect.isPending || !connection?.available}>
              {connect.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />} Conectar Google Calendar
            </Button>
          </div>
        )
      )}
    </div>
  );
}