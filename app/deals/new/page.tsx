import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { DealCreateForm } from "@/components/deals/DealCreateForm";

export default function NewDealPage() {
  return (
    <>
      <PageHeader
        title="New deal"
        description="Start with the property address — everything else can be filled in as you learn it."
        actions={
          <Link href="/deals">
            <Button variant="secondary" size="md">
              <ArrowLeft size={14} strokeWidth={2} />
              Back
            </Button>
          </Link>
        }
      />

      <div className="max-w-3xl mx-auto px-8 py-8">
        <DealCreateForm className="space-y-6">
          <Card>
            <CardContent className="space-y-5">
              <Section title="Property">
                <Field span={6} label="Street address" required>
                  <Input name="address" placeholder="123 Main St" required />
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
                <Field span={3} label="Purchase price">
                  <Input name="agreedPrice" type="number" min={0} placeholder="1650000" />
                </Field>
                <Field span={3} label="List price">
                  <Input name="listPrice" type="number" min={0} placeholder="1999000" />
                </Field>
              </Section>

              <hr className="border-[var(--color-border)]" />

              <Section title="Deal terms">
                <Field span={3} label="Acceptance date">
                  <Input name="acceptanceDate" type="date" />
                </Field>
                <Field span={3} label="Expiration date">
                  <Input name="expirationDate" type="date" />
                </Field>
                <Field span={2} label="Term of agreement">
                  <Input name="termOfAgreement" placeholder="30 days" />
                </Field>
                <Field span={2} label="Owed ($)">
                  <Input name="amountOwed" type="number" min={0} placeholder="0" />
                </Field>
                <div className="col-span-2 flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm text-[var(--color-text)] cursor-pointer select-none">
                    <input type="checkbox" name="weOwn" className="h-4 w-4 accent-[var(--color-accent)]" />
                    We own it
                  </label>
                </div>
              </Section>

              <hr className="border-[var(--color-border)]" />

              <Section title="Notes">
                <Field span={3} label="Source">
                  <Input name="source" placeholder="Fast Track for Elite" />
                </Field>
                <Field span={6} label="Notes">
                  <Textarea name="notes" rows={4} placeholder="Anything important about this lead..." />
                </Field>
              </Section>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Link href="/deals">
              <Button variant="ghost" size="md" type="button">
                Cancel
              </Button>
            </Link>
            <Button type="submit" variant="primary" size="md">
              Create deal
            </Button>
          </div>
        </DealCreateForm>
      </div>
    </>
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
