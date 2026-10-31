"use client";
import { SubscriptionView } from "@/components/billing/SubscriptionView";
export default function Page({ params }: { params: { id: string } }) { return <SubscriptionView id={params.id} portal />; }
