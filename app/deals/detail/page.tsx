"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, notFound } from "next/navigation";
import { ArrowLeft, Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StageStepper } from "@/components/deals/StageStepper";
import { DealEditForm } from "@/components/deals/DealEditForm";
import { DeleteDealButton } from "@/components/deals/DeleteDealButton";
import { TaskList } from "@/components/tasks/TaskList";
import { DEAL_STAGES, type DealStage } from "@/lib/types";
import { formatMoney, relativeTime } from "@/lib/utils";
import { useData } from "@/contexts/DataContext";

export default function DealDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="px-8 py-12 text-sm text-[var(--color-text-faint)]">Loading…</div>
      }
    >
      <DealDetailInner />
    </Suspense>
  );
}

function DealDetailInner() {
  const params = useSearchParams();
  const id = params.get("id");
  const { deals, contacts, tasks, documents, isLoaded } = useData();

  const deal = useMemo(() => (id ? deals.find((d) => d.id === id) : null), [deals, id]);

  const seller = useMemo(
    () => (deal?.sellerId ? contacts.find((c) => c.id === deal.sellerId) ?? null : null),
    [contacts, deal],
  );

  const dealTasks = useMemo(
    () =>
      deal
        ? tasks
            .filter((t) => t.dealId === deal.id)
            .map((t) => ({
              id: t.id,
              title: t.title,
              dueDate: t.dueDate,
              completedAt: t.completedAt,
              dealId: t.dealId,
            }))
        : [],
    [tasks, deal],
  );

  const dealDocuments = useMemo(
    () => (deal ? documents.filter((d) => d.dealId === deal.id) : []),
    [documents, deal],
  );

  if (!isLoaded) {
    return (
      <div className="px-8 py-12 text-sm text-[var(--color-text-faint)]">Loading…</div>
    );
  }

  if (!id) {
    return (
      <div className="px-8 py-12 text-sm text-[var(--color-text-muted)]">
        No deal selected.{" "}
        <Link href="/dashboard" className="text-[var(--color-accent)] hover:underline">
          Back to pipeline
        </Link>
      </div>
    );
  }

  if (!deal) notFound();

  const stage: DealStage = (DEAL_STAGES as readonly string[]).includes(deal.stage)
    ? deal.stage
    : "NEW_LEAD";

  return (
    <>
      <div className="px-8 py-6 border-b border-[var(--color-border)]">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] mb-3"
        >
          <ArrowLeft size={12} /> Back to pipeline
        </Link>

        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{deal.property.address}</h1>
            <div className="text-sm text-[var(--color-text-muted)] mt-1">
              {[deal.property.city, deal.property.state, deal.property.zip]
                .filter(Boolean)
                .join(", ") || "Location not set"}
            </div>
            <div className="flex items-center gap-3 mt-4 text-sm">
              <Stat
                label="Asking"
                value={formatMoney(deal.askingPrice ?? null, { short: true })}
              />
              <Stat
                label="Our offer"
                value={formatMoney(deal.ourOffer ?? null, { short: true })}
                accent
              />
              {deal.agreedPrice ? (
                <Stat
                  label="Agreed"
                  value={formatMoney(deal.agreedPrice, { short: true })}
                  accent
                />
              ) : null}
              <div className="text-xs text-[var(--color-text-faint)]">
                Updated {relativeTime(deal.updatedAt)}
              </div>
            </div>
          </div>

          <DeleteDealButton dealId={deal.id} />
        </div>

        <div className="mt-5">
          <StageStepper dealId={deal.id} current={stage} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 px-8 py-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Deal & property</CardTitle>
            </CardHeader>
            <CardContent>
              <DealEditForm
                dealId={deal.id}
                propertyId={deal.property.id}
                className="space-y-5"
              >
                <Section title="Property">
                  <Field span={6} label="Address">
                    <Input name="address" defaultValue={deal.property.address} required />
                  </Field>
                  <Field span={3} label="City">
                    <Input name="city" defaultValue={deal.property.city ?? ""} />
                  </Field>
                  <Field span={1} label="State">
                    <Input name="state" defaultValue={deal.property.state ?? ""} maxLength={2} />
                  </Field>
                  <Field span={2} label="ZIP">
                    <Input name="zip" defaultValue={deal.property.zip ?? ""} />
                  </Field>
                  <Field span={1} label="BR">
                    <Input
                      name="bedrooms"
                      type="number"
                      min={0}
                      defaultValue={deal.property.bedrooms ?? ""}
                    />
                  </Field>
                  <Field span={1} label="BA">
                    <Input
                      name="bathrooms"
                      type="number"
                      min={0}
                      step="0.5"
                      defaultValue={deal.property.bathrooms ?? ""}
                    />
                  </Field>
                  <Field span={2} label="Sq Ft">
                    <Input
                      name="sqft"
                      type="number"
                      min={0}
                      defaultValue={deal.property.sqft ?? ""}
                    />
                  </Field>
                  <Field span={2} label="Lot (sqft)">
                    <Input
                      name="lotSize"
                      type="number"
                      min={0}
                      defaultValue={deal.property.lotSize ?? ""}
                    />
                  </Field>
                  <Field span={2} label="Year built">
                    <Input
                      name="yearBuilt"
                      type="number"
                      min={1800}
                      max={2100}
                      defaultValue={deal.property.yearBuilt ?? ""}
                    />
                  </Field>
                  <Field span={4} label="APN (tax parcel #)">
                    <Input name="apn" defaultValue={deal.property.apn ?? ""} />
                  </Field>
                </Section>

                <hr className="border-[var(--color-border)]" />

                <Section title="Numbers">
                  <Field span={2} label="Asking price">
                    <Input
                      name="askingPrice"
                      type="number"
                      min={0}
                      defaultValue={deal.askingPrice ?? ""}
                    />
                  </Field>
                  <Field span={2} label="Our offer">
                    <Input
                      name="ourOffer"
                      type="number"
                      min={0}
                      defaultValue={deal.ourOffer ?? ""}
                    />
                  </Field>
                  <Field span={2} label="Agreed price">
                    <Input
                      name="agreedPrice"
                      type="number"
                      min={0}
                      defaultValue={deal.agreedPrice ?? ""}
                    />
                  </Field>
                  <Field span={3} label="Agreement type">
                    <Select name="agreementType" defaultValue={deal.agreementType ?? ""}>
                      <option value="">—</option>
                      <option value="PURCHASE">Purchase</option>
                      <option value="OPTION">Option</option>
                    </Select>
                  </Field>
                  <Field span={3} label="Lead source">
                    <Input name="source" defaultValue={deal.source ?? ""} />
                  </Field>
                </Section>

                <hr className="border-[var(--color-border)]" />

                <Section title="Contacts">
                  <Field span={3} label="Seller">
                    <Select name="sellerId" defaultValue={deal.sellerId ?? ""}>
                      <option value="">— None</option>
                      {contacts
                        .filter((c) => c.type === "SELLER" || c.type === "OTHER")
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.firstName} {c.lastName ?? ""}
                          </option>
                        ))}
                    </Select>
                  </Field>
                  <Field span={3} label="Realtor">
                    <Select name="realtorId" defaultValue={deal.realtorId ?? ""}>
                      <option value="">— None</option>
                      {contacts
                        .filter((c) => c.type === "REALTOR" || c.type === "OTHER")
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.firstName} {c.lastName ?? ""}
                          </option>
                        ))}
                    </Select>
                  </Field>
                </Section>

                <hr className="border-[var(--color-border)]" />

                <Section title="Notes">
                  <Field span={6} label="Notes">
                    <Textarea name="notes" defaultValue={deal.notes ?? ""} rows={5} />
                  </Field>
                </Section>

                <div className="flex justify-end">
                  <Button type="submit" variant="primary">
                    Save changes
                  </Button>
                </div>
              </DealEditForm>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Documents</CardTitle>
              <Link href={`/deals/documents/new?dealId=${deal.id}`}>
                <Button variant="secondary" size="sm">
                  <Plus size={12} />
                  Generate
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {dealDocuments.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-[var(--color-text-faint)]">
                  No documents yet. Click <em>Generate</em> to pick a template and create one.
                </div>
              ) : (
                <ul>
                  {dealDocuments.map((doc) => (
                    <DocumentRow key={doc.id} doc={doc} dealId={deal.id} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <TaskList tasks={dealTasks} dealId={deal.id} allowAdd />
            </CardContent>
          </Card>

          {seller ? (
            <Card>
              <CardHeader>
                <CardTitle>Seller</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="font-medium">
                  {seller.firstName} {seller.lastName ?? ""}
                </div>
                {seller.email ? (
                  <div className="text-[var(--color-text-muted)]">{seller.email}</div>
                ) : null}
                {seller.phone ? (
                  <div className="text-[var(--color-text-muted)] font-mono">{seller.phone}</div>
                ) : null}
                <Link
                  href={`/contacts/detail?id=${seller.id}`}
                  className="text-xs text-[var(--color-accent)] hover:underline"
                >
                  Open contact
                </Link>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function DocumentRow({
  doc,
  dealId,
}: {
  doc: ReturnType<typeof useData>["documents"][number];
  dealId: string;
}) {
  const { generateDocument } = useData();
  // Liveblocks-mode docs have fileUrl="" because bytes aren't persisted —
  // clicking Open re-fills the template against the current deal state and
  // triggers a fresh download. Backend-mode docs keep their /uploads/ link.
  const hasFile = !!doc.fileUrl;
  return (
    <li className="px-5 py-3 border-t border-[var(--color-panel-border)] first:border-t-0 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <FileText size={16} className="text-[var(--color-text-faint)]" />
        <div>
          <div className="text-sm">{doc.templateName}</div>
          <div className="text-xs text-[var(--color-text-faint)]">
            {relativeTime(doc.createdAt)} · {doc.templateFormat}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant={doc.status === "DRAFT" ? "muted" : "accent"}>
          {doc.status}
        </Badge>
        {hasFile ? (
          <a
            href={doc.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-[var(--color-accent)] hover:underline"
          >
            Open
          </a>
        ) : (
          <button
            type="button"
            onClick={() => void generateDocument(dealId, doc.templateId)}
            className="text-xs text-[var(--color-accent)] hover:underline"
            title="Re-fill the template with the deal's current data and download a fresh copy"
          >
            Download
          </button>
        )}
      </div>
    </li>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">
        {label}
      </span>
      <span
        className={`font-mono text-sm ${
          accent ? "text-[var(--color-accent)]" : "text-[var(--color-text)]"
        }`}
      >
        {value}
      </span>
    </div>
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
  span,
  children,
}: {
  label: string;
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
      <Label>{label}</Label>
      {children}
    </div>
  );
}
