import { useState, useSyncExternalStore } from "react";
import { QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { buildPlayerJoinUrl } from "@/lib/player-join-url";
import { cn } from "@/lib/utils";

const codeClassName = "text-center font-mono text-4xl tracking-widest text-foreground sm:text-5xl";

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

  function handleToggle() {
    if (heldJoinUrl === null) {
      setHeldJoinUrl(buildPlayerJoinUrl(window.location.origin, sessionCode));
    }
    setOpen((current) => !current);
  }

  const code = (
    <p className={codeClassName} aria-label="Kod sesji">
      {sessionCode}
    </p>
  );

  if (sessionStatus !== "active") {
    return code;
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        {code}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="absolute top-1/2 left-full ml-3 -translate-y-1/2"
          aria-expanded={open}
          aria-label={open ? "Ukryj kod QR" : "Pokaż kod QR"}
          onClick={handleToggle}
        >
          <QrCode aria-hidden="true" />
        </Button>
      </div>
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
