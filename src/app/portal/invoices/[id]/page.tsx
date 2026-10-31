"use client";
import { InvoiceView } from "@/components/billing/InvoiceView";
export default function Page({ params }: { params: { id: string } }) { return <InvoiceView id={params.id} portal />; }
