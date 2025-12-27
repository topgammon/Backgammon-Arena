# 🎲 Backgammon Arena - Preparation Checklist

Welcome! This checklist will guide you through everything you need to set up before we start building your Backgammon Arena app. **Complete each item and check it off as you go.**

---

## ✅ Checklist Items

### 1. Install Node.js
**What is it?** Think of Node.js as the engine that runs JavaScript on your computer (not just in a browser). It's like installing a program that lets your computer understand and run JavaScript code.

**How to do it:**
1. Go to [nodejs.org](https://nodejs.org/)
2. Download the **LTS version** (Long-Term Support - this is the stable version)
3. Run the installer and follow the prompts (just click "Next" through everything)
4. **Verify it worked:** Open your terminal/PowerShell and type:
   ```
   node -v
   ```
   You should see a version number like `v20.10.0`. If you see an error, ask for help!

**Status:** ☐ Not started  ☐ In progress  ☐ Complete

---

### 2. Install Visual Studio Code (VS Code)
**What is it?** VS Code is a free code editor - think of it like Microsoft Word, but for writing code instead of documents. It has helpful features like color-coding your code and catching mistakes.

**How to do it:**
1. Go to [code.visualstudio.com](https://code.visualstudio.com/)
2. Click "Download for Windows"
3. Run the installer and follow the prompts
4. **Optional but recommended:** When installing, check the box that says "Add to PATH" so you can open VS Code from the terminal

**Status:** ☐ Not started  ☐ In progress  ☐ Complete

---

### 3. Set Up Git and GitHub
**What is it?** Git is like a time machine for your code - it saves snapshots so you can go back if something breaks. GitHub is a website that stores your code online (like Google Drive for code).

**How to do it:**

**Part A - Install Git:**
1. Go to [git-scm.com](https://git-scm.com/)
2. Download Git for Windows
3. Run the installer (use all default settings - just keep clicking "Next")
4. **Verify it worked:** Open terminal and type:
   ```
   git --version
   ```
   You should see a version number.

**Part B - Create GitHub Account:**
1. Go to [github.com](https://github.com/)
2. Click "Sign up" in the top right
3. Create a free account (use your email)
4. Verify your email when prompted

**Status:** ☐ Not started  ☐ In progress  ☐ Complete

---

### 4. Create Your GitHub Repository
**What is it?** A repository (or "repo") is like a folder on GitHub where all your project files will live.

**How to do it:**
1. Log into your GitHub account
2. Click the **"+"** icon in the top right corner
3. Select **"New repository"**
4. Name it: `backgammon-arena`
5. Make it **Public** (so you can use free hosting later)
6. **DO NOT** check "Initialize with README" (we'll do that later)
7. Click **"Create repository"**

**Status:** ☐ Not started  ☐ In progress  ☐ Complete

---

### 5. Clone Repository to Your Computer
**What is it?** "Cloning" means downloading a copy of your empty GitHub folder to your computer so you can work on it.

**How to do it:**
1. On your new repository page, click the green **"Code"** button
2. Copy the HTTPS URL (it looks like: `https://github.com/your-username/backgammon-arena.git`)
3. Open PowerShell or Terminal
4. Navigate to your Desktop (or wherever you want the project):
   ```
   cd Desktop
   ```
5. Type this command (replace with YOUR URL):
   ```
   git clone https://github.com/your-username/backgammon-arena.git
   ```
6. Press Enter and wait for it to finish
7. You should now see a folder called "backgammon-arena" on your Desktop

**Status:** ☐ Not started  ☐ In progress  ☐ Complete

---

### 6. Set Up MongoDB Atlas (Free Cloud Database)
**What is it?** MongoDB Atlas is like a spreadsheet in the cloud that stores all your user data, game results, and leaderboards. It's free for small projects!

**How to do it:**
1. Go to [mongodb.com](https://www.mongodb.com/)
2. Click **"Try Free"** or **"Sign Up"**
3. Create an account (you can use your Google account to speed this up)
4. After logging in, you'll see "Create a deployment"
5. Choose **"M0 FREE"** (the free tier)
6. Select a cloud provider (AWS is fine) and a region close to you
7. Click **"Create"** and wait 1-2 minutes for it to set up
8. **Create a database user:**
   - Click **"Database Access"** in the left menu
   - Click **"Add New Database User"**
   - Choose "Password" authentication
   - Username: `backgammon-user` (or whatever you like)
   - Password: Create a strong password and **SAVE IT SOMEWHERE SAFE**
   - Click **"Add User"**
9. **Allow network access:**
   - Click **"Network Access"** in the left menu
   - Click **"Add IP Address"**
   - Click **"Allow Access from Anywhere"** (for now - we'll secure this later)
   - Click **"Confirm"**
10. **Get your connection string:**
    - Click **"Database"** in the left menu
    - Click **"Connect"** on your cluster
    - Choose **"Connect your application"**
    - Copy the connection string (looks like: `mongodb+srv://...`)
    - **IMPORTANT:** Replace `<password>` in the string with the password you created in step 8
    - **SAVE THIS CONNECTION STRING** - we'll need it later!

**Status:** ☐ Not started  ☐ In progress  ☐ Complete

---

### 7. Set Up Google Authentication
**What is it?** This lets users sign in with their Google account instead of creating a new password.

**How to do it:**
1. Go to [console.developers.google.com](https://console.developers.google.com/)
2. Sign in with your Google account
3. Click **"Select a project"** → **"New Project"**
4. Name it: `Backgammon Arena`
5. Click **"Create"** and wait a few seconds
6. **Enable Google+ API:**
   - Click **"APIs & Services"** → **"Library"**
   - Search for "Google+ API" and click it
   - Click **"Enable"**
7. **Create OAuth credentials:**
   - Click **"APIs & Services"** → **"Credentials"**
   - Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
   - If prompted, configure the consent screen:
     - User Type: **External**
     - App name: `Backgammon Arena`
     - Your email
     - Click **"Save and Continue"** through the steps
   - Application type: **Web application**
   - Name: `Backgammon Arena Web`
   - Authorized redirect URIs: Add `http://localhost:3000/auth/google/callback` (we'll add more later)
   - Click **"Create"**
8. **Copy your credentials:**
   - You'll see a popup with **Client ID** and **Client Secret**
   - **SAVE BOTH** - we'll need them later!

**Status:** ☐ Not started  ☐ In progress  ☐ Complete

---

### 8. Set Up Facebook Authentication
**What is it?** This lets users sign in with their Facebook account.

**How to do it:**
1. Go to [developers.facebook.com](https://developers.facebook.com/)
2. Sign in with your Facebook account
3. Click **"My Apps"** → **"Create App"**
4. Choose **"Consumer"** as the app type
5. App name: `Backgammon Arena`
6. App contact email: Your email
7. Click **"Create App"**
8. **Add Facebook Login:**
   - In the dashboard, find **"Add Products"**
   - Find **"Facebook Login"** and click **"Set Up"**
9. **Get your credentials:**
   - Click **"Settings"** → **"Basic"** in the left menu
   - You'll see **App ID** and **App Secret**
   - **SAVE BOTH** - we'll need them later!
10. **Add redirect URI:**
    - Click **"Facebook Login"** → **"Settings"** in the left menu
    - Under "Valid OAuth Redirect URIs", add: `http://localhost:3000/auth/facebook/callback`
    - Click **"Save Changes"**

**Status:** ☐ Not started  ☐ In progress  ☐ Complete

---

### 9. Research Open-Source Backgammon Libraries
**What is it?** Instead of building the game rules from scratch, we'll use code that someone else already wrote and tested. This saves months of work!

**Recommended libraries to check out:**

1. **backgammon.js by quasoft**
   - GitHub: [github.com/quasoft/backgammonjs](https://github.com/quasoft/backgammonjs)
   - **Why it's good:** Full game implementation with multiplayer support
   - **Action:** Visit the page, read the README, see if it looks complete

2. **backgammon.js by binarymax**
   - GitHub: [github.com/binarymax/backgammon.js](https://github.com/binarymax/backgammon.js)
   - **Why it's good:** Simple JavaScript implementation
   - **Action:** Check if it has the features we need

3. **GNU Backgammon (for AI)**
   - Website: [gnu.org/software/gnubg](https://www.gnu.org/software/gnubg/)
   - **Why it's good:** World-class AI engine
   - **Note:** This might need to run on the server, not in the browser

**How to do it:**
1. Visit each GitHub link above
2. Read the README files to understand what each library does
3. Check if they're actively maintained (recent commits)
4. **We'll help you pick the best one** - just let us know what you find!

**Status:** ☐ Not started  ☐ In progress  ☐ Complete

---

### 10. Install Project Dependencies (Initial Setup)
**What is it?** This creates a file that tracks all the code libraries your project needs.

**How to do it:**
1. Open PowerShell or Terminal
2. Navigate to your project folder:
   ```
   cd Desktop\backgammon-arena
   ```
   (Or wherever you cloned the repository)
3. Run this command:
   ```
   npm init -y
   ```
   The `-y` means "yes to everything" - it uses default settings
4. You should see a message saying it created `package.json`

**Status:** ☐ Not started  ☐ In progress  ☐ Complete

---

## 📝 Important Information to Save

Create a text file called `CREDENTIALS.txt` in your project folder and save:

- **MongoDB Connection String:** `mongodb+srv://...` (from step 6)
- **Google Client ID:** `...` (from step 7)
- **Google Client Secret:** `...` (from step 7)
- **Facebook App ID:** `...` (from step 8)
- **Facebook App Secret:** `...` (from step 8)

**⚠️ IMPORTANT:** Add `CREDENTIALS.txt` to `.gitignore` later so you don't accidentally share your secrets online!

---

## ✅ Ready to Proceed?

Once you've completed ALL items above, let me know and we'll move on to **Step 1: Setting up the project structure**.

**If you get stuck on any step, ask for help!** I'm here to guide you through each one.

---

## 🆘 Common Issues & Solutions

**"Command not found" errors:**
- Make sure you installed Node.js and Git correctly
- Try closing and reopening your terminal
- On Windows, you might need to restart your computer after installing Git

**"Permission denied" errors:**
- Make sure you're in the right folder
- Try running terminal as Administrator (right-click → "Run as administrator")

**Can't find MongoDB connection string:**
- Make sure you clicked "Connect" → "Connect your application"
- The connection string should start with `mongodb+srv://`

**Google/Facebook setup seems complicated:**
- Don't worry! We'll use these credentials later, so just save them for now
- The important part is getting the Client ID and Secret

