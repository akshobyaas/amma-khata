# Amma Khata

A free two-phone app: Akshobya adds expenses, Amma pays any part by UPI, and Canara Bank's emails confirm each payment.

- **App:** static web app on GitHub Pages (`index.html`, `app.js`, `src/`)
- **Data and notifications:** Firebase on the free Spark plan. No billing card.
- **Payment check and reminders:** Google Apps Script in your Gmail (`apps-script/`)

Try the screens without any setup: open `index.html?demo=amma` or `?demo=owner` from a local server (`python -m http.server`).

Run the tests with `npm test` (Node 20+).

---

## Setup (about an hour, once)

### 1. Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com), choose **Add project**, name it `amma-khata`, and turn Analytics off. Stay on the **Spark (free)** plan, and never add a card.
2. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable.**
3. **Build → Firestore Database → Create database.** Choose **Production mode** and location **asia-south1 (Mumbai)**.
4. Open Firestore's **Rules** tab, paste in all of `firestore.rules`, and click **Publish**.
5. Open Firestore's **Data** tab and choose **Start collection**:
   - Collection ID: `config`
   - Document ID: `setup`
   - Field `ownerKey` (string): a long secret only you know, for your phone
   - Field `ammaKey` (string): a different long secret, for Amma's phone

   Each phone uses its key once. Amma's phone only ever holds `ammaKey`, so it can't act as yours.
6. **Project settings (⚙) → General → Your apps → Web (`</>`).** Register an app called `amma-khata`, without Hosting. Copy the config values into `firebase-config.js`.
7. **Project settings → Cloud Messaging → Web Push certificates → Generate key pair.** Copy the key into `vapidKey` in `firebase-config.js`.
8. **Project settings → Service accounts → Generate new private key.** A JSON file downloads. Keep it private and never upload it to GitHub; `.gitignore` already blocks the usual names.

### 2. Put the app online (GitHub Pages)

1. Push this folder to the `amma-khata` repo on GitHub.
2. In the repo, go to **Settings → Pages → Deploy from a branch → `main` / root**.
3. The app is live at `https://akshobyaas.github.io/amma-khata/`.

`firebase-config.js` being public is normal for Firebase web apps. Access is controlled by `firestore.rules` and the setup key.

### 3. Gmail script

1. Go to [script.google.com](https://script.google.com) and create a **New project** called `Amma Khata`.
2. Under **Project Settings**, tick **Show "appsscript.json"**. Then replace its contents with `apps-script/appsscript.json`.
3. Replace `Code.gs` with `apps-script/Code.gs`. Then add a script file named `canara` and paste in `apps-script/canara.gs`.
4. Under **Project Settings → Script Properties**, add:

   | Property | Value |
   | --- | --- |
   | `PROJECT_ID` | `project_id` from the JSON key |
   | `SA_EMAIL` | `client_email` from the JSON key |
   | `SA_KEY` | `private_key` from the JSON key: the whole block, `-----BEGIN…` to `…END PRIVATE KEY-----\n` |
   | `AMMA_NAMES` | `A T SRIDHAR,U A BHAVANTH` |
   | `APP_URL` | `https://akshobyaas.github.io/amma-khata/` |

5. Choose the `setup` function and click **Run**. Allow access when Google asks, which happens once. It then checks Canara emails every 5 minutes, flags stale payments hourly, and sends the 11 pm and 8 am reminders.

### 4. Your phone

1. In Chrome, open `https://akshobyaas.github.io/amma-khata/#setup-owner` and enter `ownerKey`.
2. Tap **Turn on reminders** and allow notifications.
3. Chrome menu **⋮ → Add to Home screen / Install app**.
4. Open `https://akshobyaas.github.io/amma-khata/tools/seed.html` and tap **Add 9 expenses**. This adds the 13 Nov list (₹5,210) once.

### 5. Amma's phone

1. In Chrome, open `…/amma-khata/#setup-amma` and enter `ammaKey`.
2. Tap **ಜ್ಞಾಪನೆಗಳನ್ನು ಆನ್ ಮಾಡಿ** and allow notifications.
3. **⋮ → Add to Home screen.**
4. Go to **Settings → Apps → Chrome → Battery** and set it to **Unrestricted**. Do the same for the installed app if it's listed. Without this, some phones delay notifications.

### 6. Check it works

- [ ] In Apps Script, run `testPush`. Both phones should get a notification.
- [ ] On Amma's phone, tap **ಬೇರೆ ಮೊತ್ತ**, enter ₹1, and pay. Within 5 minutes her screen should show **ಪಾವತಿ ಯಶಸ್ವಿ** and both phones get a notification.
- [ ] Check the rules in Firestore's **Rules → Rules playground**:
  - an unauthenticated read of `/expenses/x` → **denied**
  - a read of `/config/setup` by any user → **denied**
  - a create on `/devices/abc` as uid `abc` with `role: 'owner'` and the **amma** key → **denied**
  - an update of a paid expense (one with `paidBy` set) by your owner uid → **denied**
- [ ] Use it next to WhatsApp for a week before relying on it.

## How payments are matched

- Amma's Pay buttons record a **waiting** payment, then open her UPI app.
- When a Canara credit email from `A T SRIDHAR` or `U A BHAVANTH` arrives, the script confirms the oldest waiting payment with the **same amount**. It saves the UPI reference so the same email is never counted twice.
- A credit from her that matches nothing (for example, paid on WhatsApp outside the app) appears on your screen under **Needs checking**. A payment still waiting after 24 hours goes there too.
- Credits from anyone else are ignored.
- Record cash yourself with **Record cash**.

## Files

| Path | What it does |
| --- | --- |
| `src/ledger.js` | balance, unpaid items, oldest-first allocation, edit lock, 24 h rule |
| `src/canara.js` | reads Canara alerts, matches them (copied to `apps-script/canara.gs`) |
| `src/format.js` | ₹ formatting, IST date, what each Pay button asks for |
| `src/upi.js`, `src/i18n.js` | UPI link, English and Kannada text |
| `src/db.js` | Firestore reads and writes |
| `src/views/` | Amma's and your screens |
| `apps-script/Code.gs` | email check, reminders, push sending |
| `firestore.rules` | who can read and write what |
