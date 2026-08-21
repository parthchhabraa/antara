import { AntaraLoader } from "@/components/AntaraLoader";

// Next.js App Router's own loading-UI convention — shown automatically
// during a route segment's server render / chunk load (distinct from
// AppBootGate, which covers the client-side auth-check window). Same
// component, same "no fixed duration" property: Next.js unmounts this the
// instant the real route is ready, not on a timer.
export default function Loading() {
  return <AntaraLoader />;
}
