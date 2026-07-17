import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface Props {
  name: string;
  schema: any;
  required?: boolean;
  value: unknown;
  onChange: (v: unknown) => void;
}

export function SchemaField({ name, schema, required, value, onChange }: Props) {
  const label = (
    <Label className="text-xs font-medium flex items-center gap-1">
      <code>{name}</code>
      {required && <span className="text-destructive">*</span>}
      <span className="text-muted-foreground font-normal">
        {schema?.format ? `· ${schema.format}` : schema?.type ? `· ${schema.type}` : ""}
      </span>
    </Label>
  );

  if (Array.isArray(schema?.enum)) {
    return (
      <div className="space-y-1">
        {label}
        <Select value={(value as string) ?? ""} onValueChange={(v) => onChange(v)}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Selecione…" /></SelectTrigger>
          <SelectContent>
            {schema.enum.map((v: string) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        {schema?.description && <p className="text-[11px] text-muted-foreground">{schema.description}</p>}
      </div>
    );
  }

  if (schema?.type === "boolean") {
    return (
      <div className="flex items-center justify-between gap-3 py-2">
        <div>{label}{schema?.description && <p className="text-[11px] text-muted-foreground">{schema.description}</p>}</div>
        <Switch checked={!!value} onCheckedChange={onChange} />
      </div>
    );
  }

  if (schema?.type === "integer" || schema?.type === "number") {
    return (
      <div className="space-y-1">
        {label}
        <Input
          type="number"
          value={(value as number | string) ?? ""}
          min={schema?.minimum}
          max={schema?.maximum}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          className="h-9"
        />
        {schema?.description && <p className="text-[11px] text-muted-foreground">{schema.description}</p>}
      </div>
    );
  }

  const long = schema?.maxLength && schema.maxLength > 200;
  return (
    <div className="space-y-1">
      {label}
      {long ? (
        <Textarea value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} rows={3} />
      ) : (
        <Input value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className="h-9" placeholder={schema?.format === "uuid" ? "00000000-0000-0000-0000-000000000000" : undefined} />
      )}
      {schema?.description && <p className="text-[11px] text-muted-foreground">{schema.description}</p>}
    </div>
  );
}
