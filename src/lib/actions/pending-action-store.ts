/**
 * Pending action persistence — currently delegates to server-store via confirmation.ts.
 * Kept as a dedicated module so Chat and Voice share one import path.
 */
export {
  createPendingAction,
  getPendingAction,
  rejectPendingAction,
  expirePendingActions,
  confirmPendingAction,
  executeConfirmedAction,
} from "@/lib/actions/action-manager";
