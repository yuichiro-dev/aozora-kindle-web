type BookCountProps = {
  count: number | null;
  lastUpdated: string;
  hidden: boolean;
};

export default function BookCount({ count, lastUpdated, hidden }: BookCountProps) {
  return (
    <div className={`transition-all ${hidden ? 'hidden' : 'block pb-1'}`}>
      <p className="text-xs sm:text-sm font-medium text-foreground/80">
        {count !== null && `収録数: ${count.toLocaleString()}冊`}
        {lastUpdated && `（最終更新: ${lastUpdated}）`}
      </p>
    </div>
  );
}
