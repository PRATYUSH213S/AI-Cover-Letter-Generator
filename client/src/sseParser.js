/**
 * Splits buffered SSE text into complete "data:" payloads.
 * Incomplete trailing events stay in the returned rest buffer until the next
 * network chunk arrives.
 */
export function parseSseEvents(buffer) {
  const events = [];
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";

  for (const part of parts) {
    for (const line of part.split("\n")) {
      if (line.startsWith("data: ")) {
        events.push(JSON.parse(line.slice(6)));
      }
    }
  }
  return { events, rest };
}
