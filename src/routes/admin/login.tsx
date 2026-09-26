import { createFileRoute, redirect } from "@tanstack/react-router";

// The admin panel no longer needs a password; keep old links working.
export const Route = createFileRoute("/admin/login")({
  beforeLoad: () => {
    throw redirect({ to: "/admin", replace: true });
  },
});
