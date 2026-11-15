import { create } from 'zustand';
import { User, Session, AuthError, type Subscription } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, getSupabaseEmailRedirectUrl } from '../utils/supabase';
import { LoggingService } from '../services/logging';
import { syncActiveResearchProfile } from '../services/researchProfile';
import { normalizeResearchProfile } from '../types/researchProfile';
let hasInitializedAuth = false;
let authStateSubscription: Subscription | null = null;

interface AuthStoreState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  statusMessage: string | null;
  isConfigured: boolean;

  initialize: () => Promise<void>;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: AuthError | null; hasActiveSession: boolean }>;
  signUp: (
    email: string,
    password: string,
    metadata?: Record<string, any>
  ) => Promise<{ error: AuthError | null; hasActiveSession: boolean }>;
  signOut: () => Promise<void>;
  updateProfileMetadata: (metadata: Record<string, any>) => Promise<{ error: AuthError | null }>;
  clearError: () => void;
}

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  user: null,
  session: null,
  isLoading: true,
  error: null,
  statusMessage: null,
  isConfigured: isSupabaseConfigured,

  initialize: async () => {
    if (!isSupabaseConfigured) {
      set({ isLoading: false });
      return;
    }

    if (hasInitializedAuth) {
      set({ isLoading: false });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await syncActiveResearchProfile(
          normalizeResearchProfile(session.user.user_metadata?.research_profile)
        );
      }
      set({
        session,
        user: session?.user ?? null,
        isLoading: false,
        statusMessage: null,
      });

      authStateSubscription?.unsubscribe();
      authStateSubscription = supabase.auth.onAuthStateChange((event, session) => {
        set({
          session,
          user: session?.user ?? null,
          statusMessage: session ? null : get().statusMessage,
        });
      }).data.subscription;
      hasInitializedAuth = true;
    } catch (error) {
      LoggingService.warn('Auth initialization failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      set({ isLoading: false });
    }
  },

  signIn: async (email, password) => {
    if (!isSupabaseConfigured) {
      return {
        error: { message: 'Supabase not configured' } as AuthError,
        hasActiveSession: false,
      };
    }

    set({ isLoading: true, error: null, statusMessage: null });

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      set({ error: error.message, isLoading: false });
      return { error, hasActiveSession: false };
    }

    set({
      session: data.session,
      user: data.user,
      isLoading: false,
      statusMessage: null,
    });

    if (data.session?.user) {
      await syncActiveResearchProfile(
        normalizeResearchProfile(data.user.user_metadata?.research_profile)
      );
    }

    return { error: null, hasActiveSession: !!data.session };
  },

  signUp: async (email, password, metadata) => {
    if (!isSupabaseConfigured) {
      return {
        error: { message: 'Supabase not configured' } as AuthError,
        hasActiveSession: false,
      };
    }

    set({ isLoading: true, error: null, statusMessage: null });

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getSupabaseEmailRedirectUrl(),
        data: metadata,
      },
    });

    if (error) {
      set({ error: error.message, isLoading: false });
      return { error, hasActiveSession: false };
    }

    const hasActiveSession = !!data.session;
    set({
      session: data.session,
      user: hasActiveSession ? data.user : null,
      isLoading: false,
      statusMessage: hasActiveSession
        ? null
        : 'Check your email to confirm the account, then return here and sign in.',
    });

    if (hasActiveSession && data.user) {
      await syncActiveResearchProfile(
        normalizeResearchProfile(data.user.user_metadata?.research_profile)
      );
    }

    return { error: null, hasActiveSession };
  },

  signOut: async () => {
    if (!isSupabaseConfigured) return;

    set({ isLoading: true });

    await supabase.auth.signOut();

    set({
      user: null,
      session: null,
      isLoading: false,
      statusMessage: null,
    });
  },

  updateProfileMetadata: async (metadata) => {
    if (!isSupabaseConfigured) {
      return { error: null };
    }

    set({ isLoading: true, error: null });

    const { data, error } = await supabase.auth.updateUser({
      data: metadata,
    });

    if (error) {
      set({ error: error.message, isLoading: false });
      return { error };
    }

    set({
      user: data.user,
      session: get().session,
      isLoading: false,
    });

    if (Object.prototype.hasOwnProperty.call(metadata, 'research_profile')) {
      const syncResult = await syncActiveResearchProfile(
        normalizeResearchProfile(metadata.research_profile)
      );

      if (syncResult.error) {
        return {
          error: {
            message: syncResult.error,
          } as AuthError,
        };
      }
    }

    return { error: null };
  },

  clearError: () => set({ error: null, statusMessage: null }),
}));
