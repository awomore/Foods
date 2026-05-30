import { useState, useEffect, useCallback } from 'react';
import { healthApi, type CustomerHealthProfile } from '../api/health';
import { useAuth } from '../context/AuthContext';

export function useHealthProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<CustomerHealthProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!user) { setProfile(null); return; }
    setLoading(true);
    try {
      const r = await healthApi.getProfile();
      setProfile(r.health_profile);
    } catch {
      // Health profile is optional — fail silently
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { reload(); }, [reload]);

  return { profile, loading, reload };
}
