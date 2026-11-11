// Stripe refund updates may arrive late and out of order. For the same
// provider refund ID, terminal states are immutable until an explicit
// reconciliation workflow establishes a different provider record.
export function shouldApplyRefundStatus(previousStatus,nextStatus){
  const previous=String(previousStatus||'').toLowerCase();
  const next=String(nextStatus||'').toLowerCase();
  if(!new Set(['pending','succeeded','failed','canceled']).has(next))return false;
  if(previous===next)return false;
  if(new Set(['succeeded','failed','canceled']).has(previous))return false;
  return true;
}
