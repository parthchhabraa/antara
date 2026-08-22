"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";
import { saveMonthlyBudget } from "./api";
import { UserProfile } from "@/types";

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  isSuperAdmin: boolean;
  isDemoMode: boolean;
  loading: boolean;
  isNewUser: boolean; // true for exactly the session where a real profile doc was just created
  dismissNewUserBanner: () => void;
  pendingConsent: boolean; // Step 12: true between a first-ever real sign-in and them confirming the consent checkbox
  confirmConsent: () => Promise<void>;
  declineConsent: () => Promise<void>;
  pendingBudgetSetup: boolean; // Step 13: true right after consent (or for an existing real account that's never set one) until a real monthly amount is saved
  setMonthlyBudget: (amount: number) => Promise<void>;
  toggleDemoMode: () => void;
  signInWithGoogle: () => Promise<void>;
  signInAsGuest: () => void;
  signInWithDemoSuperadmin: () => void;
  signOut: () => Promise<void>;
  refreshClaims: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Step 13: monthly_budget starts at 0 for a brand-new real (non-superadmin)
// account — 0 is the "not yet set" sentinel that pendingBudgetSetup checks
// for (see needsBudgetSetup below), not a real budget anyone would have.
// Superadmin keeps the old flat default since that gate is skipped for them
// (see the onAuthStateChanged handler) — it's the developer's own account,
// not someone who needs an onboarding prompt.
const buildNewProfile = (fbUser: FirebaseUser, isSuper: boolean): UserProfile => ({
  uid: fbUser.uid,
  email: fbUser.email,
  displayName: fbUser.displayName || fbUser.email?.split("@")[0] || "Antara Teen",
  photoURL: fbUser.photoURL,
  role: isSuper ? "superadmin" : "user",
  is_demo_mode: false,
  monthly_budget: isSuper ? 5000 : 0,
  created_at: new Date().toISOString(),
  // Step 8 streak fields — real accounts only, start at zero.
  currentStreak: 0,
  longestStreak: 0,
  lastLoggedDate: null,
  streakFreezesAvailable: 0,
});

// Step 13: true when a real, non-superadmin profile has never had a monthly
// budget saved — covers both a brand-new profile (built with the 0 sentinel
// above) and a pre-Step-13 profile that predates this field ever being
// user-editable. Superadmin and demo/guest fallback profiles always carry a
// real positive default, so this is never true for them.
const needsBudgetSetup = (p: UserProfile, isSuper: boolean): boolean => !isSuper && (!p.monthly_budget || p.monthly_budget <= 0);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [isNewUser, setIsNewUser] = useState<boolean>(false);
  const [pendingConsent, setPendingConsent] = useState<boolean>(false);
  const [pendingConsentUser, setPendingConsentUser] = useState<FirebaseUser | null>(null);
  const [pendingBudgetSetup, setPendingBudgetSetup] = useState<boolean>(false);

  const checkAllowlist = async (email: string | null): Promise<boolean> => {
    if (!email) return false;
    try {
      const allowlistRef = doc(db, "admin", "betaAllowlist");
      const snap = await getDoc(allowlistRef);
      if (!snap.exists()) return false;
      const emails: string[] = (snap.data().emails as string[]) || [];
      return emails.some((e) => e?.toLowerCase() === email.toLowerCase());
    } catch (e) {
      console.warn("Beta allowlist check failed:", e);
      return false;
    }
  };

  // Step 12: public-launch toggle. Doesn't replace checkAllowlist above —
  // it's an independent, additional path in, superadmin-controlled via
  // admin/launchConfig (see SuperadminPanel.tsx's PublicSignupToggle).
  // Fails closed on any error or a missing doc, same posture as
  // checkAllowlist: an unreadable config should never accidentally open
  // signup, only ever accidentally keep it closed.
  const checkPublicSignupEnabled = async (): Promise<boolean> => {
    try {
      const launchConfigRef = doc(db, "admin", "launchConfig");
      const snap = await getDoc(launchConfigRef);
      if (!snap.exists()) return false;
      return snap.data().publicSignupEnabled === true;
    } catch (e) {
      console.warn("Launch config check failed:", e);
      return false;
    }
  };

  const checkSuperAdminClaim = async (fbUser: FirebaseUser): Promise<boolean> => {
    try {
      const tokenResult = await fbUser.getIdTokenResult(true);
      const isSuper = tokenResult.claims.role === "superadmin" || fbUser.email === "parthchhabra6112@gmail.com";
      setIsSuperAdmin(isSuper);
      return isSuper;
    } catch (e) {
      console.error("Error inspecting user claims:", e);
      return false;
    }
  };

  /** Loads an existing profile doc if one exists. Returns { existed, profile } — profile is null only when this is a brand-new account (no doc, Firestore reachable). */
  const loadExistingProfile = async (
    fbUser: FirebaseUser,
    isSuper: boolean
  ): Promise<{ existed: boolean; profile: UserProfile | null }> => {
    try {
      const userDocRef = doc(db, "users", fbUser.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const loaded = userDoc.data() as UserProfile;
        setProfile(loaded);
        return { existed: true, profile: loaded };
      }
      return { existed: false, profile: null };
    } catch (err) {
      console.warn("Firestore profile fetch skipped in mock/demo mode:", err);
      const fallback: UserProfile = {
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName || "Antara User",
        photoURL: fbUser.photoURL,
        role: isSuper ? "superadmin" : "user",
        is_demo_mode: isDemoMode,
        monthly_budget: 5000,
        created_at: new Date().toISOString(),
        currentStreak: 0,
        longestStreak: 0,
        lastLoggedDate: null,
        streakFreezesAvailable: 0,
      };
      setProfile(fallback);
      // Firestore itself is unreachable — treat as "handled" rather than
      // routing into the consent gate (or the budget gate — a real write
      // would fail here anyway), which would just fail the same way.
      return { existed: true, profile: fallback };
    }
  };

  const createProfile = async (fbUser: FirebaseUser, isSuper: boolean): Promise<UserProfile> => {
    const newProfile = buildNewProfile(fbUser, isSuper);
    await setDoc(doc(db, "users", fbUser.uid), newProfile);
    setProfile(newProfile);
    // Real account, brand new — this is the one moment to tell them the
    // cold-start/trained-embedding split (Step 4/8) affects what they'll
    // actually see, before they wonder why "Why this pace?" says
    // "early estimate" for the first two weeks.
    setIsNewUser(true);
    return newProfile;
  };

  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        setUser(fbUser);
        if (fbUser) {
          const isSuper = await checkSuperAdminClaim(fbUser);
          const { existed, profile: loadedProfile } = await loadExistingProfile(fbUser, isSuper);

          if (isSuper) {
            if (!existed) await createProfile(fbUser, true);
            setIsDemoMode(false);
          } else {
            // Step 12: two independent paths to Live Mode — the existing
            // allowlist (unchanged) and the new public-signup toggle. Either
            // one is enough; neither is required if the other passes.
            const publicOpen = await checkPublicSignupEnabled();
            const allowed = publicOpen || (await checkAllowlist(fbUser.email));
            if (allowed) {
              if (existed) {
                setIsDemoMode(false);
                // Step 13: an already-existing real account that's never set
                // a real budget (a pre-Step-13 profile, or the 0 sentinel —
                // shouldn't normally happen since confirmConsent below
                // always routes a brand-new account through this gate first,
                // but this covers it defensively too).
                if (loadedProfile && needsBudgetSetup(loadedProfile, false)) {
                  setPendingBudgetSetup(true);
                }
              } else {
                // Step 12: brand-new real account, allowed in, but hasn't
                // confirmed the consent checkbox yet. Don't create the
                // profile or drop them into Live Mode until they do —
                // ConsentGate (rendered by AppBootGate) is the only thing
                // between here and confirmConsent()/declineConsent() below.
                setPendingConsentUser(fbUser);
                setPendingConsent(true);
              }
            } else {
              console.warn(`Beta access blocked for ${fbUser.email}: not on allowlist and public signup is off.`);
              alert(
                "This Google account isn't on the Antara beta allowlist yet. You've been signed out and returned to Demo Mode until a superadmin approves your email."
              );
              await fbSignOut(auth);
              setUser(null);
              setIsSuperAdmin(false);
              signInAsGuest();
            }
          }
        } else {
          // Initialize default local demo profile
          setProfile({
            uid: "demo-teen-uid",
            email: "teen@antara.app",
            displayName: "Kabir Sharma",
            photoURL: null,
            role: "user",
            is_demo_mode: true,
            monthly_budget: 4500,
            created_at: new Date().toISOString(),
          });
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("Auth initialization fallback:", e);
      setLoading(false);
    }
  }, []);

  const toggleDemoMode = () => {
    setIsDemoMode((prev) => !prev);
  };

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Google sign in error:", err);
      // If Firebase credentials are not populated, fall back seamlessly
      alert("Note: Connecting to Firebase... If API keys are unset, please use Demo / Guest mode.");
    }
  };

  const signInAsGuest = () => {
    setIsDemoMode(true);
    setIsSuperAdmin(false);
    setProfile({
      uid: "guest-user-" + Math.floor(Math.random() * 1000),
      email: "guest@antara.app",
      displayName: "Arjun (Student)",
      photoURL: null,
      role: "user",
      is_demo_mode: true,
      monthly_budget: 3500,
      created_at: new Date().toISOString(),
    });
  };

  const signInWithDemoSuperadmin = () => {
    setIsDemoMode(true);
    setIsSuperAdmin(true);
    setProfile({
      uid: "superadmin-parth",
      email: "parthchhabra6112@gmail.com",
      displayName: "Parth (Superadmin)",
      photoURL: null,
      role: "superadmin",
      is_demo_mode: true,
      monthly_budget: 10000,
      created_at: new Date().toISOString(),
    });
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
    } catch (e) {
      console.warn("Sign out fallback:", e);
    }
    setUser(null);
    setIsSuperAdmin(false);
    setPendingConsent(false);
    setPendingConsentUser(null);
    setPendingBudgetSetup(false);
    signInAsGuest();
  };

  const refreshClaims = async () => {
    if (user) {
      const isSuper = await checkSuperAdminClaim(user);
      await loadExistingProfile(user, isSuper);
    }
  };

  const dismissNewUserBanner = () => setIsNewUser(false);

  // Step 12: called by ConsentGate when the user checks the box and confirms.
  // This is the actual point a new real account's profile gets created and
  // Live Mode opens up — nothing before this point wrote anything to
  // Firestore for them.
  const confirmConsent = async () => {
    if (!pendingConsentUser) return;
    await createProfile(pendingConsentUser, false);
    setIsDemoMode(false);
    setPendingConsent(false);
    setPendingConsentUser(null);
    // Step 13: a brand-new non-superadmin profile always starts with the
    // monthly_budget: 0 sentinel (see buildNewProfile) — so this is
    // unconditional here, not another needsBudgetSetup check. AppBootGate
    // shows BudgetSheet next, right after ConsentGate and before the first
    // Today screen, per the brief.
    setPendingBudgetSetup(true);
  };

  // Declining doesn't create a profile and doesn't grant Live Mode access —
  // signs them back out to Demo Mode, same outcome as being blocked by the
  // allowlist, just for a different reason.
  const declineConsent = async () => {
    setPendingConsent(false);
    setPendingConsentUser(null);
    await signOut();
  };

  // Step 13 — saves a real monthly budget, used by both BudgetSheet's
  // onboarding call (clears pendingBudgetSetup, unblocking AppBootGate) and
  // its later "Edit" call (pendingBudgetSetup is already false there, so
  // this is a no-op on that front, just the write + local state update).
  // No real `user` (Demo/Guest mode, which never runs Firestore-backed
  // profiles at all) still updates local profile state so the same "Edit"
  // control works there too, just without a Firestore write to make.
  const setMonthlyBudgetField = async (amount: number) => {
    if (user) {
      await saveMonthlyBudget(user.uid, amount);
    }
    setProfile((prev) => (prev ? { ...prev, monthly_budget: amount } : prev));
    setPendingBudgetSetup(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isSuperAdmin,
        isDemoMode,
        loading,
        isNewUser,
        dismissNewUserBanner,
        pendingConsent,
        confirmConsent,
        declineConsent,
        pendingBudgetSetup,
        setMonthlyBudget: setMonthlyBudgetField,
        toggleDemoMode,
        signInWithGoogle,
        signInAsGuest,
        signInWithDemoSuperadmin,
        signOut,
        refreshClaims,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
