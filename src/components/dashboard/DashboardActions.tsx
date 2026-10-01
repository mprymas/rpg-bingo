import { Button } from "@/components/ui/button";

interface Props {
  kind: "new-session" | "sign-out";
}

export default function DashboardActions({ kind }: Props) {
  if (kind === "new-session") {
    return (
      <Button asChild>
        <a href="/sessions/new">Nowa sesja</a>
      </Button>
    );
  }

  return (
    <form method="POST" action="/api/auth/signout" className="pt-2">
      <Button type="submit" variant="outline">
        Wyloguj
      </Button>
    </form>
  );
}
