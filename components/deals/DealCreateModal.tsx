"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useData } from "@/contexts/DataContext";
import { dealCreatePayloadFromFormData } from "@/lib/forms/dealCreatePayload";

export function DealCreateModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Called with the new deal's id after a successful create. Used by the
  // pipeline page to scroll the new row into view + highlight it.
  onCreated?: (id: string) => void;
}) {
  const { addDeal } = useData();
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // Local key bumped on close so the next open starts with a fresh, empty form
  // without us having to manually reset every <input>.
  const [formKey, setFormKey] = useState(0);

  function close() {
    setFormKey((k) => k + 1);
    onOpenChange(false);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = dealCreatePayloadFromFormData(new FormData(e.currentTarget));

    startTransition(async () => {
      const id = await addDeal(body);
      if (!id) return;
      // Every new deal lands in NEW_LEAD (ACTIVES). Stage transitions are an
      // explicit user action via the row's stage chip — keeps "what schema
      // does this use" orthogonal to "which list does it appear in."
      toast.success("Deal created");
      onCreated?.(id);
      close();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader
        title="New deal"
        description="Start with the property address — everything else can be filled in as you learn it."
      />
      <form key={formKey} ref={formRef} onSubmit={onSubmit}>
        <DialogBody className="space-y-5">
          <Section title="Property">
            <Field span={6} label="Street address" required>
              <Input name="address" placeholder="123 Main St" required autoFocus />
            </Field>
            <Field span={3} label="City">
              <Input name="city" placeholder="Palm Springs" />
            </Field>
            <Field span={1} label="State">
              <Input name="state" placeholder="CA" maxLength={2} />
            </Field>
            <Field span={2} label="ZIP">
              <Input name="zip" placeholder="92262" />
            </Field>
            <Field span={1} label="Bedrooms">
              <Input name="bedrooms" type="number" min={0} />
            </Field>
            <Field span={1} label="Bathrooms">
              <Input name="bathrooms" type="number" min={0} step="0.5" />
            </Field>
            <Field span={2} label="Sq Ft">
              <Input name="sqft" type="number" min={0} />
            </Field>
            <Field span={2} label="Lot size (sqft)">
              <Input name="lotSize" type="number" min={0} />
            </Field>
          </Section>

          <hr className="border-[var(--color-border)]" />

          <Section title="Numbers">
            <Field span={3} label="Asking price">
              <Input name="askingPrice" type="number" min={0} placeholder="2000000" />
            </Field>
            <Field span={3} label="Our offer">
              <Input name="ourOffer" type="number" min={0} placeholder="1750000" />
            </Field>
            <Field span={3} label="Source">
              <Input name="source" placeholder="Fast Track for Elite" />
            </Field>
          </Section>

          <hr className="border-[var(--color-border)]" />

          <Section title="Notes">
            <Field span={6} label="Notes">
              <Textarea name="notes" rows={4} placeholder="Anything important about this lead..." />
            </Field>
          </Section>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="ghost" size="md" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" disabled={pending}>
            {pending ? "Creating…" : "Create deal"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-3">
        {title}
      </div>
      <div className="grid grid-cols-6 gap-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  span,
  children,
}: {
  label: string;
  required?: boolean;
  span: 1 | 2 | 3 | 4 | 6;
  children: React.ReactNode;
}) {
  const spans: Record<number, string> = {
    1: "col-span-1",
    2: "col-span-2",
    3: "col-span-3",
    4: "col-span-4",
    6: "col-span-6",
  };
  return (
    <div className={spans[span]}>
      <Label>
        {label}
        {required ? <span className="text-[var(--color-accent)] ml-1">*</span> : null}
      </Label>
      {children}
    </div>
  );
}
