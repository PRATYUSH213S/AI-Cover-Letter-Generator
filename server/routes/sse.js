/**
 * Minimal Server-Sent Events helpers (Sprint 04 Phase 3).
 * Events are single-line JSON payloads:  data: {"...":...}\n\n
 */
export function startSse(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // disable buffering on reverse proxies
  });
  res.flushHeaders();
}

export function sendEvent(res, payload) {
  if (res.writableEnded || res.destroyed) return;
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

/** A signal that aborts as soon as the client disconnects (Stop button, closed tab). */
export function clientGoneSignal(req, res) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  req.on("aborted", abort);
  res.on("close", () => {
    if (!res.writableEnded) abort();
  });
  return controller.signal;
}
