"use client";

import React from "react";
import { useParams } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import { PageTransition } from "@/components/PageTransition";
import { ProfileView } from "@/components/ProfileView";
import { useAuth } from "@/lib/AuthContext";

// Social feature — friend-view profile route. Same ProfileView component
// as the self route (profile/page.tsx), just isSelf=false and no self-only
// numeric props — the component itself enforces never rendering those for
// a friend view. The category-comparison data ProfileView fetches for this
// case is verified friends-only server-side (social.py raises 403 if the
// two accounts aren't actually friends), so a stranger hitting this URL
// directly still can't see anything beyond identity + badges + archetype,
// and even that read is friends-only at the Firestore rules layer too.
export default function FriendProfilePage() {
  const params = useParams<{ uid: string }>();
  const { user, isDemoMode } = useAuth();
  const viewUid = Array.isArray(params.uid) ? params.uid[0] : params.uid;

  return (
    <MobileFrame>
      <PageTransition>
        {viewUid && (
          <ProfileView viewUid={viewUid} isSelf={false} user={user} isDemoMode={isDemoMode} />
        )}
      </PageTransition>
    </MobileFrame>
  );
}
