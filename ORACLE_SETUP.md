# Running aria-RPG on Oracle Cloud (Always Free ARM)

Goal: move off Render's 0.1-CPU free tier to an Oracle **Ampere A1 (ARM)**
Always-Free VM (up to **4 cores / 24GB RAM**, free forever) so the bot can keep
up with decrypting 16 groups of traffic.

Your **DB and WhatsApp session live in Aiven**, so the new host reconnects with
the **same session — no re-link** (as long as only ONE instance runs at a time).

---

## 1. Create the VM (Oracle Console — one-time)

1. Sign up at https://cloud.oracle.com (needs a card for verification, **not charged** on Always Free).
2. **Compute → Instances → Create Instance.**
3. **Image & shape → Change shape → Ampere → `VM.Standard.A1.Flex`.**
   Set **OCPU = 4**, **Memory = 24 GB** (the full Always-Free allowance).
4. **Image:** Canonical **Ubuntu 22.04** (ARM/aarch64).
5. **Add SSH key:** paste your public key.
   On Windows (PowerShell): `ssh-keygen -t ed25519` → paste `~/.ssh/id_ed25519.pub`.
6. Keep **"Assign a public IPv4 address"** checked. **Create.**
7. Note the instance's **public IP**.

> If "out of capacity" for A1: try a different Availability Domain/region, or
> retry later — Always-Free ARM capacity is sometimes tight.

---

## 2. Connect & install (on the VM)

```bash
ssh ubuntu@<PUBLIC_IP>

sudo apt update && sudo apt upgrade -y
# Node 20 (matches package.json engines) + build tools for native deps
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git build-essential python3
node -v          # expect v20.x

git clone https://github.com/NarSungUchiha1/aria-RPG.git
cd aria-RPG
```

### Create the .env
Copy **every** environment variable from Render (Dashboard → aria-RPG →
Environment) into a `.env` file here:

```bash
nano .env
```
Include at minimum: `DB_HOST DB_USER DB_PASS DB_NAME DB_PORT`,
`BOT_PHONE_NUMBER OWNER_ID RAID_GROUP_JID`, your AI keys
(`GROQ_API_KEY` / `GEMINI_API_KEY` — whatever's set on Render),
`COMMUNITY_JID`, `TEST_GROUP_JID`, `PORT`, and any others Render lists.

### Install deps + pm2
```bash
npm install
sudo npm install -g pm2
```

---

## 3. Cut over from Render (order matters!)

**Stop Render FIRST** so only one process uses the WhatsApp session (two at once
= 440 "connection replaced" conflicts):

- Render → aria-RPG → **Settings → Suspend** (or delete). Confirm it's stopped.

Then start on Oracle:
```bash
pm2 start ecosystem.config.js
pm2 logs aria-rpg          # watch it connect
```

- It loads the session from Aiven and should print `✅ ARIA ONLINE` — **no re-link**.
- **If** it asks to pair (session invalid): the pairing code prints in the logs
  (`📱 PAIRING CODE: ...`). In WhatsApp → **Linked Devices → Link a device →
  Link with phone number** → enter the code.

### Keep it alive across reboots
```bash
pm2 save
pm2 startup    # run the exact `sudo env PATH=... pm2 startup ...` line it prints
```

---

## 4. Deploying updates later

```bash
cd ~/aria-RPG
git pull
npm install            # only if dependencies changed
pm2 restart aria-rpg
```

---

## Notes

- **Single instance only.** Never run Render and Oracle at the same time, and
  never `pm2 scale` / cluster mode — one WhatsApp connection only.
- The Render self-ping / UptimeRobot is **no longer needed** (a VM doesn't spin
  down). Harmless to leave in the code.
- **Web dashboard (optional):** to reach the Express dashboard on `PORT`, open it
  in Oracle's VCN **Security List** (ingress rule) *and* the VM firewall
  (`sudo iptables -I INPUT 6 -p tcp --dport <PORT> -j ACCEPT` then persist with
  `sudo netfilter-persistent save`). Not required if you pair via `pm2 logs`.
- **More CPU headroom:** once stable, the in-code concurrency caps can be raised
  (`MAX_CONCURRENT_COMMANDS` in index.js, `MAX_AI_CONCURRENT` in
  src/systems/aiSystems.js) — ask and I'll tune them up for the bigger box.
