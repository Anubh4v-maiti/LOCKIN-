import { Skeleton } from "@/components/ui/misc";

export default function AppLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-20 w-full rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-56 w-full rounded-2xl" />
    </div>
  );
}
