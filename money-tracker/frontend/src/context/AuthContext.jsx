import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import Client from '../api/client';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes (login/logout)
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setLoading(false);

      if (currentUser && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        Client.seedCategories().catch(err => {
          console.error('Error seeding default categories:', err);
        });
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      // Pre-check if Supabase URL is reachable before triggering full-page browser redirect
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const url = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL || 'https://tdjynchyarsgujxzomfz.supabase.co';
      
      await fetch(`${url}/rest/v1/`, { method: 'GET', signal: controller.signal, headers: { 'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY || '' } })
        .catch((err) => {
          throw new Error(`Supabase backend domain is unreachable (${url}). The Supabase project may be paused, expired, or deleted.`);
        });
      clearTimeout(timeoutId);
    } catch (checkErr) {
      if (checkErr.message.includes('unreachable')) {
        throw checkErr;
      }
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) {
      throw error;
    }
  };

  const signOut = async () => {
    sessionStorage.removeItem('has_seen_intro_session');
    await supabase.auth.signOut();
  };

  const markIntroVideoSeen = async () => {
    await supabase.auth.updateUser({ data: { has_seen_intro_video: true } });
    setUser((prev) => prev ? { ...prev, user_metadata: { ...prev.user_metadata, has_seen_intro_video: true } } : prev);
  };

  const value = {
    user,
    loading,
    signInWithGoogle,
    signOut,
    markIntroVideoSeen
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
