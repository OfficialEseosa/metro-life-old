import { create } from "zustand";
import type { Sim } from "../api/types";
import { money } from "./helpers";
import "./money-ledger.css";
type Request = {
  amount: number;
  reason: string;
  remaining: number | null;
  rent: number;
  resolve: (answer: boolean) => void;
};
const usePurchase = create<{ request: Request | null }>(() => ({
  request: null,
}));
export function confirmPurchase(
  amount: number,
  reason: string,
  sim?: Pick<Sim, "cash" | "home"> | null,
): Promise<boolean> {
  if (amount <= 50) return Promise.resolve(true);
  if (usePurchase.getState().request) return Promise.resolve(false);
  return new Promise((resolve) =>
    usePurchase.setState({
      request: {
        amount,
        reason,
        remaining: sim ? sim.cash - amount : null,
        rent: sim?.home.rent ?? 0,
        resolve,
      },
    }),
  );
}
export function PurchaseConfirmation() {
  const request = usePurchase((s) => s.request);
  if (!request) return null;
  const answer = (value: boolean) => {
    usePurchase.setState({ request: null });
    request.resolve(value);
  };
  return (
    <div
      className="purchase-confirmation"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm purchase"
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") answer(false);
      }}
    >
      <div>
        <h2>Confirm {money(request.amount)}</h2>
        <p>{request.reason}</p>
        {request.remaining !== null && (
          <p>
            After this purchase: <strong>{money(request.remaining)}</strong>
          </p>
        )}
        {request.remaining !== null &&
          request.remaining < request.rent + 24 && (
            <p className="rent-warning">
              Your next rent is {money(request.rent)}. This purchase leaves less
              than rent and a day's meals.
            </p>
          )}
        <div className="purchase-buttons">
          <button autoFocus onClick={() => answer(false)}>
            Keep my money
          </button>
          <button className="primary" onClick={() => answer(true)}>
            Pay {money(request.amount)}
          </button>
        </div>
      </div>
    </div>
  );
}
