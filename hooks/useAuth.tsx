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
        if (error.message.includes('Refresh Token') || error.status === 400 || error.message.includes('not found')) {
          if (typeof window !== 'undefined') {
            try {
              const keysToRemove = [];
              for (let i = 0; i < window.localStorage.length; i++) {
                const key = window.localStorage.key(i);
                if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                  keysToRemove.push(key);
                }
              }
              keysToRemove.forEach(k => window.localStorage.removeItem(k));
            } catch (e) {
              console.error('Error clearing invalid session storage:', e);
            }
          }
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
      // Usar getUser() (siempre consulta el servidor) en lugar de getSession() (puede estar en caché)
      // Esto garantiza que user_metadata.workshop_id siempre esté actualizado
      const { data: freshUserData } = await supabase.auth.getUser();
      const authUser = freshUserData?.user;

      const { data, error } = await supabase
        .from('profiles')
        .select('*, roles(name)')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Profile fetch error:', error.message);
      } else if (data) {
        if (data.is_active === false) {
          console.warn('Usuario desactivado o desconectado remotamente.');
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
          if (typeof window !== 'undefined') {
            window.location.href = '/login?reason=disconnected';
          }
          return;
        }

        // Priorizar user_metadata (fresco del servidor) sobre la tabla profiles
        const extendedProfile = {
          ...data,
          workshop_id: authUser?.user_metadata?.workshop_id || data.workshop_id || null
        };
        setProfile(extendedProfile);
      } else {
        console.info('No profile found for user:', userId);
      }
    } catch (err) {
      // Quietly handle the error to not block the UI
    } finally {
      setLoading(false);
    }
  };

  // Realtime force disconnect listener
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`user-disconnect-listener-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'global_audit_logs',
          filter: `event_type=eq.FORCE_DISCONNECT`
        },
        (payload) => {
          const log = payload.new;
          if (log && (log.affected_record === user.email || log.user_id === user.id || log.affected_record === user.id)) {
            alert('⚡ Tu sesión ha sido terminada remotamente por el Super Administrador.');
            supabase.auth.signOut().then(() => {
              window.location.href = '/login?reason=remote_disconnect';
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          if (payload.new && payload.new.is_active === false) {
            alert('🔒 Tu cuenta ha sido desactivada por el Administrador.');
            supabase.auth.signOut().then(() => {
              window.location.href = '/login?reason=disabled';
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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
