import { useState, useSyncExternalStore } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { buildPlayerJoinUrl } from "@/lib/player-join-url";
import { cn } from "@/lib/utils";

interface Props {
  sessionCode: string;
  /** When not `"active"`, the QR control is hidden. */
  sessionStatus: string;
  /** Kitchen-sink: start with the panel open. */
  defaultOpen?: boolean;
}

function subscribeToOrigin(): () => void {
  return () => undefined;
}

function readBrowserOrigin(): string {
  return window.location.origin;
}

function readServerOrigin(): string {
  return "";
}

export default function SessionJoinQr({ sessionCode, sessionStatus, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [heldJoinUrl, setHeldJoinUrl] = useState<string | null>(null);
  const origin = useSyncExternalStore(subscribeToOrigin, readBrowserOrigin, readServerOrigin);
  const joinUrl = heldJoinUrl ?? (open && origin !== "" ? buildPlayerJoinUrl(origin, sessionCode) : null);

  if (sessionStatus !== "active") {
    return null;
  }

  function handleToggle() {
    if (heldJoinUrl === null) {
      setHeldJoinUrl(buildPlayerJoinUrl(window.location.origin, sessionCode));
    }
    setOpen((current) => !current);
  }

  return (
    <div className={cn("flex flex-col items-center gap-3")}>
      <Button
        type="button"
        variant="outline"
        className={cn("cursor-pointer")}
        aria-expanded={open}
        onClick={handleToggle}
      >
        {open ? "Ukryj kod QR" : "Pokaż kod QR"}
      </Button>
      {joinUrl !== null ? (
        <div
          className={cn("border-border bg-background rounded-lg border p-4", !open && "hidden")}
          data-join-url={open ? joinUrl : undefined}
        >
          <QRCodeSVG value={joinUrl} marginSize={4} title="Dołącz do sesji" aria-label="Dołącz do sesji" />
        </div>
      ) : null}
    </div>
  );
}
