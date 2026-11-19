// Builds a UPI intent link. Her phone offers the UPI apps that can open it.
// Built by hand: some UPI apps reject %40 for @ or show + for spaces.
export function upiLink({ pa, pn, amount, note }) {
  if (!(amount > 0)) throw new Error('Amount must be more than zero');
  const enc = s => encodeURIComponent(s).replace(/%40/g, '@');
  return `upi://pay?pa=${enc(pa)}&pn=${enc(pn)}&am=${amount.toFixed(2)}&cu=INR&tn=${enc(note)}`;
}
