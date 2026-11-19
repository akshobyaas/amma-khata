// Every visible string, English and Kannada. Item names are shown as typed.
export const strings = {
  en: {
    balance: 'Balance due', allClear: 'Nothing due', credit: 'Paid extra',
    paySelected: 'Pay selected', payAll: 'Pay all', otherAmount: 'Other amount',
    enterAmount: 'Enter amount', pay: 'Pay', cancel: 'Cancel',
    waiting: 'Waiting for confirmation', waitingHint: 'This changes by itself when the money reaches Akshobya.',
    confirmed: 'Payment received', didntPay: "I didn't pay",
    history: 'Payments', noPayments: 'No payments yet',
    statusWaiting: 'Waiting', statusConfirmed: 'Received', statusNeedsCheck: 'Being checked', statusCancelled: 'Cancelled',
    cash: 'Cash', unpaidItems: 'Unpaid items',
    addExpense: 'Add', item: 'Item', amount: 'Amount', date: 'Date',
    save: 'Save', delete: 'Delete', edit: 'Edit',
    needsChecking: 'Needs checking', check: 'Check', coversItems: 'Which items does this cover?',
    confirmReceived: 'Confirm received', notReceived: 'Not received', recordCash: 'Record cash',
    creditLeft: 'left as credit',
    setupTitle: 'Set up this phone', setupKey: 'Setup key', setupButton: 'Set up',
    setupWrong: "That key didn't work. Check it and try again.",
    notSetUp: "This phone isn't set up yet. Open the setup link Akshobya sent.",
    allowNotifications: 'Turn on reminders'
  },
  kn: {
    balance: 'ಬಾಕಿ', allClear: 'ಏನೂ ಬಾಕಿ ಇಲ್ಲ', credit: 'ಹೆಚ್ಚುವರಿ ಪಾವತಿ',
    paySelected: 'ಆಯ್ಕೆ ಮಾಡಿದ್ದು ಪಾವತಿಸಿ', payAll: 'ಎಲ್ಲಾ ಪಾವತಿಸಿ', otherAmount: 'ಬೇರೆ ಮೊತ್ತ',
    enterAmount: 'ಮೊತ್ತ ನಮೂದಿಸಿ', pay: 'ಪಾವತಿಸಿ', cancel: 'ರದ್ದು',
    waiting: 'ದೃಢೀಕರಣಕ್ಕೆ ಕಾಯುತ್ತಿದೆ', waitingHint: 'ಹಣ ಅಕ್ಷೋಭ್ಯನಿಗೆ ತಲುಪಿದಾಗ ಇದು ತಾನಾಗಿಯೇ ಬದಲಾಗುತ್ತದೆ.',
    confirmed: 'ಪಾವತಿ ಯಶಸ್ವಿ', didntPay: 'ನಾನು ಪಾವತಿಸಿಲ್ಲ',
    history: 'ಪಾವತಿಗಳು', noPayments: 'ಇನ್ನೂ ಯಾವುದೇ ಪಾವತಿ ಇಲ್ಲ',
    statusWaiting: 'ಕಾಯುತ್ತಿದೆ', statusConfirmed: 'ತಲುಪಿದೆ', statusNeedsCheck: 'ಪರಿಶೀಲನೆಯಲ್ಲಿ', statusCancelled: 'ರದ್ದಾಗಿದೆ',
    cash: 'ನಗದು', unpaidItems: 'ಬಾಕಿ ವಸ್ತುಗಳು',
    addExpense: 'ಸೇರಿಸಿ', item: 'ವಸ್ತು', amount: 'ಮೊತ್ತ', date: 'ದಿನಾಂಕ',
    save: 'ಉಳಿಸಿ', delete: 'ಅಳಿಸಿ', edit: 'ಬದಲಿಸಿ',
    needsChecking: 'ಪರಿಶೀಲಿಸಬೇಕು', check: 'ಪರಿಶೀಲಿಸಿ', coversItems: 'ಇದು ಯಾವ ವಸ್ತುಗಳಿಗೆ?',
    confirmReceived: 'ತಲುಪಿದೆ ಎಂದು ದೃಢೀಕರಿಸಿ', notReceived: 'ತಲುಪಿಲ್ಲ', recordCash: 'ನಗದು ದಾಖಲಿಸಿ',
    creditLeft: 'ಹೆಚ್ಚುವರಿಯಾಗಿ ಉಳಿದಿದೆ',
    setupTitle: 'ಈ ಫೋನ್ ಸಿದ್ಧಪಡಿಸಿ', setupKey: 'ಸೆಟಪ್ ಕೀ', setupButton: 'ಸಿದ್ಧಪಡಿಸಿ',
    setupWrong: 'ಆ ಕೀ ಸರಿಯಿಲ್ಲ. ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
    notSetUp: 'ಈ ಫೋನ್ ಇನ್ನೂ ಸಿದ್ಧವಾಗಿಲ್ಲ. ಅಕ್ಷೋಭ್ಯ ಕಳುಹಿಸಿದ ಸೆಟಪ್ ಲಿಂಕ್ ತೆರೆಯಿರಿ.',
    allowNotifications: 'ಜ್ಞಾಪನೆಗಳನ್ನು ಆನ್ ಮಾಡಿ'
  }
};

export function t(key, lang) {
  return (strings[lang] && strings[lang][key]) || key;
}
