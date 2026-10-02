const LABELS: Record<string, string> = {
  "auth.login": "Signed in",
  "auth.password_change": "Changed their password",
  "auth.password_reset_requested": "Requested a password reset",
  "auth.password_reset": "Reset their password",
  "auth.refresh_reuse": "Session ended: reused sign-in token",
  "user.create": "Created a user",
  "user.update": "Updated a user",
  "user.delete": "Deleted a user",
  "user.password_set": "Set a user's password",
  "school.update": "Updated the school profile",
  "school.create": "Created the school",
  "school.module_toggle": "Changed a module",
};

export function describeAudit(action: string, meta: Record<string, unknown>, entityId: string | null) {
  if (action === "school.module_toggle") {
    return `${meta.enabled ? "Enabled" : "Disabled"} the ${entityId ?? ""} module`;
  }
  return LABELS[action] ?? action;
}
