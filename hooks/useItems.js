'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export function useItems(partyId, storageFilter = 'all') {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchItems = useCallback(async () => {
    if (!partyId) {
      setItems([]);
      setLoading(false);
      return;
    }

    let query = supabase
      .from('items')
      .select('*')
      .eq('party_id', partyId)
      .eq('status', 'active')
      .order('effective_expiry_date', { ascending: true, nullsFirst: false });

    if (storageFilter !== 'all') {
      query = query.eq('storage_type', storageFilter);
    }

    const { data, error: fetchError } = await query;
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setItems(data ?? []);
      setError(null);
    }
    setLoading(false);
  }, [partyId, storageFilter]);

  useEffect(() => {
    setLoading(true);
    fetchItems();
  }, [fetchItems]);

  // Realtime 구독
  useEffect(() => {
    if (!partyId) return;

    const channel = supabase
      .channel(`items-${partyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items', filter: `party_id=eq.${partyId}` },
        () => fetchItems()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [partyId, fetchItems]);

  const updateStatus = useCallback(async (itemId, newStatus) => {
    const patch = {
      status: newStatus,
      ...(newStatus === 'eaten'     && { eaten_at:     new Date().toISOString() }),
      ...(newStatus === 'discarded' && { discarded_at: new Date().toISOString() }),
    };
    const { error: err } = await supabase.from('items').update(patch).eq('id', itemId);
    if (err) throw err;
  }, []);

  return { items, loading, error, refetch: fetchItems, updateStatus };
}
