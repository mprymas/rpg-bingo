import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  kind: "new-session" | "sign-out";
  /** Kitchen-sink: block real navigation / sign-out */
  demo?: boolean;
  /** Kitchen-sink: force-visible focus ring */
  demoFocus?: boolean;
}

export default function DashboardActions({ kind, demo = false, demoFocus = false }: Props) {
  const focusClass = demoFocus ? "border-ring ring-2 ring-ring" : undefined;

  if (kind === "new-session") {
    return (
      <Button asChild className={cn(focusClass)}>
        <a
          href="/sessions/new"
          onClick={(e) => {
            if (demo) e.preventDefault();
          }}
        >
          Nowa sesja
        </a>
      </Button>
    );
  }

  return (
    <form
      method="POST"
      action="/api/auth/signout"
      className="pt-2"
      onSubmit={(e) => {
        if (demo) e.preventDefault();
      }}
    >
      <Button type="submit" variant="outline" className={cn(focusClass)}>
        Wyloguj
      </Button>
    </form>
  );
}
