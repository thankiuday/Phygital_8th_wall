import { useCallback } from 'react';
import useAuthStore from '../store/useAuthStore';
import { billingService } from '../services/billingService';
import { subscriptionPatchFromBilling } from '../utils/subscriptionDisplay';

/**
 * Loads billing status from the API (syncs Stripe → DB) and merges into auth user.
 */
const useBillingSync = () => {
  const updateUser = useAuthStore((s) => s.updateUser);

  const syncBillingToUser = useCallback(async () => {
    try {
      const billing = await billingService.getStatus();
      const patch = subscriptionPatchFromBilling(billing);
      if (patch) updateUser(patch);
      return billing;
    } catch {
      return null;
    }
  }, [updateUser]);

  return { syncBillingToUser };
};

export default useBillingSync;
