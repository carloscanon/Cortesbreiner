'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  config: any;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshConfig: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  config: {},
  loading: true,
  signOut: async () => { },
  refreshConfig: async () => { },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfig();

    // Check active sessions
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.warn('Session retrieval error, clearing session:', error.message);
        // Clear session if refresh token is invalid
        if (error.message.includes('Refresh Token') || error.status === 400) {
          supabase.auth.signOut().catch(() => {});
        }
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    }).catch((err) => {
      console.error('Error fetching session:', err);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed successfully');
      }
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data } = await supabase.from('company_params').select('name, value');
      if (data) {
        const configMap = data.reduce((acc: any, curr: any) => {
          acc[curr.name] = curr.value;
          return acc;
        }, {});
        setConfig(configMap);
      }
    } catch (err) {
      console.error('Error fetching global config:', err);
    }
  };

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, roles(name)')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Profile fetch error:', error.message);
      } else if (data) {
        setProfile(data);
      } else {
        console.info('No profile found for user:', userId);
      }
    } catch (err) {
      // Quietly handle the error to not block the UI
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshConfig = async () => {
    await fetchConfig();
  };

  return (
    <AuthContext.Provider value={{ user, profile, config, loading, signOut, refreshConfig }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
