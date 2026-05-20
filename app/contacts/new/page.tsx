import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ContactFormFields } from "@/components/contacts/ContactForm";
import { ContactEditForm } from "@/components/contacts/ContactEditForm";

export default function NewContactPage() {
  return (
    <>
      <PageHeader
        title="New contact"
        actions={
          <Link href="/contacts">
            <Button variant="secondary">
              <ArrowLeft size={14} /> Back
            </Button>
          </Link>
        }
      />
      <div className="max-w-3xl mx-auto px-8 py-8">
        <ContactEditForm>
          <Card>
            <CardContent>
              <ContactFormFields />
            </CardContent>
          </Card>
          <div className="flex justify-end gap-2 mt-4">
            <Link href="/contacts">
              <Button variant="ghost" type="button">
                Cancel
              </Button>
            </Link>
            <Button type="submit">Create contact</Button>
          </div>
        </ContactEditForm>
      </div>
    </>
  );
}
