import { useEffect, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  GM_BOARD_EDIT_STATE_EVENT,
  readGmBoardEditStateDetail,
  requestGmBoardCancelEdit,
  requestGmBoardCommitEdit,
  requestGmBoardEdit,
} from "@/components/sessions/gm-board-edit";

interface Props {
  sessionId: string;
  /** When not `"active"`, the control is hidden — same gate as regenerate. */
  sessionStatus?: string;
  /** Kitchen-sink: header already in edit mode before the board publishes state. */
  initialEditing?: boolean;
  /** Kitchen-sink: tick starts enabled when the fixture already has overrides. */
  initialCanCommit?: boolean;
}

export default function GmRerollEditButton({
  sessionId,
  sessionStatus,
  initialEditing = false,
  initialCanCommit = false,
}: Props) {
  const [editing, setEditing] = useState(initialEditing);
  const [canCommit, setCanCommit] = useState(initialCanCommit);
  const [busy, setBusy] = useState(false);
  const [committing, setCommitting] = useState(false);

  useEffect(() => {
    function onState(event: Event) {
      const detail = readGmBoardEditStateDetail(event);
      if (detail?.sessionId !== sessionId) return;
      setEditing(detail.editing);
      setCanCommit(detail.canCommit);
      setBusy(detail.busy);
      setCommitting(detail.committing);
    }

    window.addEventListener(GM_BOARD_EDIT_STATE_EVENT, onState);
    return () => {
      window.removeEventListener(GM_BOARD_EDIT_STATE_EVENT, onState);
    };
  }, [sessionId]);

  if (sessionStatus !== "active") {
    return null;
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer"
          aria-label="Anuluj"
          disabled={busy}
          onClick={() => {
            requestGmBoardCancelEdit(sessionId);
          }}
        >
          <X className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer"
          aria-label="Zatwierdź"
          disabled={busy || !canCommit}
          onClick={() => {
            requestGmBoardCommitEdit(sessionId);
          }}
        >
          {committing ? (
            <span
              className="border-foreground/30 border-t-foreground size-4 animate-spin rounded-full border-2"
              aria-hidden="true"
            />
          ) : (
            <Check className="size-4" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="cursor-pointer"
      aria-label="Wymień hasła"
      onClick={() => {
        requestGmBoardEdit(sessionId);
      }}
    >
      <Pencil className="size-4" />
    </Button>
  );
}
