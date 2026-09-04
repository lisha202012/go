function SkeletonBlock({ className = '' }) {
  return <div className={`animate-pulse rounded-2xl bg-violet-900/40 ${className}`} />;
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-3">
      <div>
        <SkeletonBlock className="h-7 w-52" />
        <SkeletonBlock className="mt-1.5 h-4 w-40" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SkeletonBlock className="h-[4.25rem]" />
        <SkeletonBlock className="h-[4.25rem]" />
      </div>
      <SkeletonBlock className="aspect-[4/3] w-full" />
      <div className="grid grid-cols-2 gap-3">
        <SkeletonBlock className="h-44" />
        <SkeletonBlock className="h-44" />
      </div>
      <SkeletonBlock className="h-36" />
      <SkeletonBlock className="h-36" />
      <div className="grid grid-cols-5 gap-2">
        <SkeletonBlock className="col-span-3 h-28" />
        <SkeletonBlock className="col-span-2 h-28" />
      </div>
    </div>
  );
}
