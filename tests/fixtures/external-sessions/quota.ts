/** @file token_count fictif, structure de rate_limits relevée pour #205 ; aucun historique privé. */
export const quotaEvent = {
  timestamp: "2026-10-22T12:00:00Z", type: "event_msg",
  payload: { type: "token_count", rate_limits: { limit_id: "codex",
    primary: { used_percent: 52, window_minutes: 300, resets_at: 1792612031 },
    secondary: { used_percent: 88, window_minutes: 10080, resets_at: 1793103085 }
  } }
};
