import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import type { Id } from '@/data/types';

/** The open task lives in the URL (?task=id), so back, forward and reload all behave. */
export function useOpenTask(): (id: Id | null) => void {
  const navigate = useNavigate();
  return useCallback(
    (id) => {
      void navigate({ to: '.', search: (prev) => ({ ...prev, task: id ?? undefined }) });
    },
    [navigate],
  );
}
