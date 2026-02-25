# How to Publish AquaSense360 to GitHub

This guide explains how to push your code updates to GitHub.

## 1. Prerequisites (Done for you ✅)
- **Git** is installed.
- **`.gitignore`** is set up to exclude sensitive files (like passwords in `.env`) and heavy folders (`node_modules`).
- **Repository** is connected to: [https://github.com/oshandimantha/auqa360-NEW](https://github.com/oshandimantha/auqa360-NEW)

---

## 2. Pushing Updates (Routine)
Whenever you make changes to the code, run these 3 commands in your terminal:

### Step 1: Stage Changes
This tells Git to track all modified files.
```bash
git add .
```

### Step 2: Commit Changes
Save a snapshot of your changes with a message.
```bash
git commit -m "Describe what you changed here"
```
*Example: `git commit -m "Fixed oxygen pump logic"`*

### Step 3: Push to GitHub
Upload your commit to the cloud.
```bash
git push
```

---

## 3. Common Issues & Fixes

### "Updates were rejected because the remote contains work..."
If you changed files on GitHub directly (e.g., edited README), you need to pull them first:
```bash
git pull
```
Then try pushing again.

### "Authentication failed"
If GitHub asks for a password, you might need a **Personal Access Token** instead of your account password, or use the browser prompt if it appears.

---

## 4. One-Time Setup (Reference)
*These steps were already done for this project, but good to know for future projects:*

1. **Initialize Git**: `git init` inside your project folder.
2. **Create .gitignore**: Add `node_modules`, `.env`, `.DS_Store` to it.
3. **Commit**: `git add .` and `git commit -m "Initial commit"`.
4. **Create Repo**: Go to GitHub.com -> New Repository.
5. **Connect**: `git remote add origin <HTML_URL>`
6. **Push**: `git push -u origin main`
