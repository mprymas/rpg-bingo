export const GM_BOARD_ENTER_EDIT_EVENT = "gm-board:enter-edit";
export const GM_BOARD_CANCEL_EDIT_EVENT = "gm-board:cancel-edit";
export const GM_BOARD_COMMIT_EDIT_EVENT = "gm-board:commit-edit";
export const GM_BOARD_EDIT_STATE_EVENT = "gm-board:edit-state";

export interface GmBoardEnterEditDetail {
  sessionId: string;
}

export interface GmBoardEditStateDetail {
  sessionId: string;
  editing: boolean;
  canCommit: boolean;
  busy: boolean;
  committing: boolean;
}

function sessionDetail(sessionId: string): GmBoardEnterEditDetail {
  return { sessionId };
}

export function requestGmBoardEdit(sessionId: string): void {
  window.dispatchEvent(
    new CustomEvent<GmBoardEnterEditDetail>(GM_BOARD_ENTER_EDIT_EVENT, {
      detail: sessionDetail(sessionId),
    }),
  );
}

export function requestGmBoardCancelEdit(sessionId: string): void {
  window.dispatchEvent(
    new CustomEvent<GmBoardEnterEditDetail>(GM_BOARD_CANCEL_EDIT_EVENT, {
      detail: sessionDetail(sessionId),
    }),
  );
}

export function requestGmBoardCommitEdit(sessionId: string): void {
  window.dispatchEvent(
    new CustomEvent<GmBoardEnterEditDetail>(GM_BOARD_COMMIT_EDIT_EVENT, {
      detail: sessionDetail(sessionId),
    }),
  );
}

export function publishGmBoardEditState(detail: GmBoardEditStateDetail): void {
  window.dispatchEvent(new CustomEvent<GmBoardEditStateDetail>(GM_BOARD_EDIT_STATE_EVENT, { detail }));
}

export function readGmBoardEnterEditDetail(event: Event): GmBoardEnterEditDetail | null {
  if (!(event instanceof CustomEvent)) return null;
  const detail: unknown = event.detail;
  if (!detail || typeof detail !== "object") return null;
  const sessionId = (detail as { sessionId?: unknown }).sessionId;
  if (typeof sessionId !== "string" || sessionId.length === 0) return null;
  return { sessionId };
}

export function readGmBoardEditStateDetail(event: Event): GmBoardEditStateDetail | null {
  const session = readGmBoardEnterEditDetail(event);
  if (!session || !(event instanceof CustomEvent)) return null;
  const detail = event.detail as Partial<GmBoardEditStateDetail>;
  if (typeof detail.editing !== "boolean" || typeof detail.canCommit !== "boolean") return null;
  if (typeof detail.busy !== "boolean" || typeof detail.committing !== "boolean") return null;
  return {
    sessionId: session.sessionId,
    editing: detail.editing,
    canCommit: detail.canCommit,
    busy: detail.busy,
    committing: detail.committing,
  };
}
