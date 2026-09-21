import { Navigate, useLocation } from "react-router-dom";

/**
 * Old app URLs (before the app moved under /app) still live in e-mails, push
 * notifications and bookmarks. Redirect them, preserving search and hash.
 */
export function LegacyRedirect() {
  const location = useLocation();
  const target = `/app${location.pathname}${location.search}${location.hash}`;
  return <Navigate to={target} replace />;
}

export const LEGACY_APP_PATHS = [
  "teams",
  "boards",
  "team-config",
  "demands",
  "demand-requests",
  "folders",
  "projects",
  "store",
  "kanban",
  "time-management",
  "board-summary",
  "user",
  "team-demands",
  "my-demands",
  "notes",
  "reports",
  "profile",
  "settings",
  "pricing",
  "welcome",
  "complete-profile",
  "subscription",
];

export default LegacyRedirect;
