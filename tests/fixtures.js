// The 13 Nov list (opening data from the spec)
export const opening = [
  ['Petrol', 1750], ['Bangalore trip', 1540], ['Electricity', 95], ['Vegetables', 87],
  ['Socks', 320], ['Kerchief', 200], ['Body wash', 675], ['Face wash', 328], ['Body lotion', 215],
].map(([item, amount], i) => ({ id: 'e' + i, item, amount, date: '2026-11-13', createdAt: i, notifiedAt: null, paidBy: null }));
