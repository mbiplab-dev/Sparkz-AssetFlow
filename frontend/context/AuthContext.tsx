"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  fetchCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  requestLoginOtp as requestLoginOtpRequest,
  requestSignupOtp as requestSignupOtpRequest,
  verifyLoginOtp as verifyLoginOtpRequest,
  verifySignupOtp as verifySignupOtpRequest,
  type AuthUser,
  type LoginInput,
  type OtpVerifyInput,
  type SignupOtpRequestInput,
} from "@/lib/auth/authApi";
import { clearAccessToken, getAccessToken } from "@/lib/auth/tokenStorage";

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  requestSignupOtp: (input: SignupOtpRequestInput) => Promise<void>;
  verifySignupOtp: (input: OtpVerifyInput) => Promise<void>;
  requestLoginOtp: (email: string) => Promise<void>;
  verifyLoginOtp: (input: OtpVerifyInput) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, if a token was left in localStorage from a previous visit,
  // validate it against the backend and hydrate the user - otherwise the
  // app has no way to know who's logged in until the next explicit call.
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (!getAccessToken()) {
        setIsLoading(false);
        return;
      }
      try {
        const currentUser = await fetchCurrentUser();
        if (!cancelled) setUser(currentUser);
      } catch {
        clearAccessToken();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const session = await loginRequest(input);
    setUser(session.user);
  }, []);

  const requestSignupOtp = useCallback(async (input: SignupOtpRequestInput) => {
    await requestSignupOtpRequest(input);
  }, []);

  const verifySignupOtp = useCallback(async (input: OtpVerifyInput) => {
    const session = await verifySignupOtpRequest(input);
    setUser(session.user);
  }, []);

  const requestLoginOtp = useCallback(async (email: string) => {
    await requestLoginOtpRequest(email);
  }, []);

  const verifyLoginOtp = useCallback(async (input: OtpVerifyInput) => {
    const session = await verifyLoginOtpRequest(input);
    setUser(session.user);
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      login,
      requestSignupOtp,
      verifySignupOtp,
      requestLoginOtp,
      verifyLoginOtp,
      logout,
    }),
    [
      user,
      isLoading,
      login,
      requestSignupOtp,
      verifySignupOtp,
      requestLoginOtp,
      verifyLoginOtp,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
