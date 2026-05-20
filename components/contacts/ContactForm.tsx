import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { CONTACT_TYPES, CONTACT_TYPE_LABELS } from "@/lib/types";

type Defaults = {
  type?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
};

export function ContactFormFields({ defaults = {} }: { defaults?: Defaults }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-6 gap-4">
        <div className="col-span-2">
          <Label>Type</Label>
          <Select name="type" defaultValue={defaults.type ?? "SELLER"}>
            {CONTACT_TYPES.map((t) => (
              <option key={t} value={t}>
                {CONTACT_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>
        <div className="col-span-2">
          <Label>
            First name <span className="text-[var(--color-accent)]">*</span>
          </Label>
          <Input name="firstName" required defaultValue={defaults.firstName ?? ""} />
        </div>
        <div className="col-span-2">
          <Label>Last name</Label>
          <Input name="lastName" defaultValue={defaults.lastName ?? ""} />
        </div>
        <div className="col-span-3">
          <Label>Email</Label>
          <Input name="email" type="email" defaultValue={defaults.email ?? ""} />
        </div>
        <div className="col-span-3">
          <Label>Phone</Label>
          <Input name="phone" defaultValue={defaults.phone ?? ""} />
        </div>
        <div className="col-span-6">
          <Label>Company</Label>
          <Input name="company" defaultValue={defaults.company ?? ""} />
        </div>
        <div className="col-span-6">
          <Label>Notes</Label>
          <Textarea name="notes" rows={3} defaultValue={defaults.notes ?? ""} />
        </div>
      </div>
    </div>
  );
}
