// Unread message totals for the signed-in user, keyed by the other person's id.
//
// One subscription serves every badge in the app — the rows on the landing
// screen and the count on the Chat tab — so adding a badge somewhere new costs
// nothing.

import { useEffect, useMemo, useState } from "react";

import { listenForUnreadCounts, type UnreadByContact } from "../api";

export const useUnreadCounts = (userId: string | null) => {
  const [counts, setCounts] = useState<UnreadByContact>({});

  useEffect(() => {
    if (!userId) {
      setCounts({});
      return;
    }
    return listenForUnreadCounts(userId, setCounts);
  }, [userId]);

  const total = useMemo(
    () => Object.values(counts).reduce((sum, count) => sum + count, 0),
    [counts],
  );

  return { counts, total };
};
