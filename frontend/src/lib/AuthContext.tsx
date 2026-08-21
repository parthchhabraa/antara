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
import { UserProfile } from "@/types";

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  isSuperAdmin: boolean;
  isDemoMode: boolean;
  loading: boolean;
  isNewUser: boolean; // true for exactly the session where a real profile doc was just created
  dismissNewUserBanner: () => void;
  toggleDemoMode: () => void;
  signInWithGoogle: () => Promise<void>;
  signInAsGuest: () => void;
  signInWithDemoSuperadmin: () => void;
  signOut: () => Promise<void>;
  refreshClaims: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [isNewUser, setIsNewUser] = useState<boolean>(false);

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

  const checkClaimsAndLoadProfile = async (fbUser: FirebaseUser): Promise<boolean> => {
    let isSuper = false;
    try {
      const tokenResult = await fbUser.getIdTokenResult(true);
      isSuper = tokenResult.claims.role === "superadmin" || fbUser.email === "parthchhabra6112@gmail.com";
      setIsSuperAdmin(isSuper);

      // Fetch or create user profile in Firestore
      try {
        const userDocRef = doc(db, "users", fbUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          setProfile(userDoc.data() as UserProfile);
        } else {
          const newProfile: UserProfile = {
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName || fbUser.email?.split("@")[0] || "Antara Teen",
            photoURL: fbUser.photoURL,
            role: isSuper ? "superadmin" : "user",
            is_demo_mode: false,
            monthly_budget: 5000,
            created_at: new Date().toISOString(),
            // Step 8 streak fields — real accounts only, start at zero.
            currentStreak: 0,
            longestStreak: 0,
            lastLoggedDate: null,
            streakFreezesAvailable: 0,
          };
          await setDoc(userDocRef, newProfile);
          setProfile(newProfile);
          // Real account, brand new — this is the one moment to tell them the
          // cold-start/trained-embedding split (Step 4/8) affects what they'll
          // actually see, before they wonder why "Why this pace?" says
          // "early estimate" for the first two weeks.
          setIsNewUser(true);
        }
      } catch (err) {
        console.warn("Firestore profile fetch skipped in mock/demo mode:", err);
        setProfile({
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
        });
      }
    } catch (e) {
      console.error("Error inspecting user claims:", e);
    }
    return isSuper;
  };

  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        setUser(fbUser);
        if (fbUser) {
          const isSuper = await checkClaimsAndLoadProfile(fbUser);
          if (isSuper) {
            setIsDemoMode(false);
          } else {
            const allowed = await checkAllowlist(fbUser.email);
            if (allowed) {
              setIsDemoMode(false);
            } else {
              console.warn(`Beta access blocked for ${fbUser.email}: not on allowlist.`);
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
    signInAsGuest();
  };

  const refreshClaims = async () => {
    if (user) {
      await checkClaimsAndLoadProfile(user);
    }
  };

  const dismissNewUserBanner = () => setIsNewUser(false);

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
