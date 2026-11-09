"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { addWater } from "@/app/actions/water";
import { Button } from "@/components/ui/button";

export function QuickWaterButtons({ logDate, disabled }: { logDate: string; disabled?: boolean }) {
  const [pending, setPending] = React.useState<number | null>(null);
  const router = useRouter();

  const add = async (amount: number) => {
    if (pending) return;
    setPending(amount);
    try {
      const result = await addWater({ log_date: logDate, amount_ml: amount });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(`+${amount} ml`);
        router.refresh();
      }
    } catch {
      toast.error("Water could not be saved. Check your connection.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {[250, 500].map((amount) => (
        <Button
          key={amount}
          type="button"
          variant="subtle"
          size="sm"
          onClick={() => add(amount)}
          disabled={disabled || pending !== null}
        >
          <Plus className="size-3" />
          {pending === amount ? "Adding…" : `${amount} ml`}
        </Button>
      ))}
    </div>
  );
}
