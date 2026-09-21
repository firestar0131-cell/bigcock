import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const card = "min-w-0 rounded-2xl bg-card p-4 ring-1 ring-white/50 backdrop-blur-xl";
export const input =
  "min-h-12 w-full min-w-0 rounded-xl bg-ink/5 px-3 py-2 text-base tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-halo";
export const secondary =
  "min-h-11 rounded-xl bg-ink/5 px-3 py-2 text-sm font-medium hover:bg-ink/10 disabled:opacity-40";
export const primary =
  "min-h-12 rounded-xl bg-ink px-4 py-3 text-sm font-bold text-paper disabled:opacity-40";
export function Confirm({
  title,
  description,
  onConfirm,
  children,
  destructive = false,
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  children: ReactNode;
  destructive?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl bg-paper text-ink">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-12">取消</AlertDialogCancel>
          <AlertDialogAction
            className={`min-h-12 ${destructive ? "bg-destructive" : "bg-ink"}`}
            onClick={onConfirm}
          >
            確認
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-ink/5 p-4 text-sm leading-relaxed text-muted">{children}</p>;
}
export function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string | undefined;
}) {
  return (
    <div className={card}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-2 font-disp text-xl font-extrabold tabular-nums sm:text-2xl">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted">{detail}</p>}
    </div>
  );
}
export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" className="min-h-11 px-0" onClick={onClick}>
      ← 返回訓練列表
    </Button>
  );
}
