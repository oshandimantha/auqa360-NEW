# AquaSense360 Setup Guide for a New Computer

Follow these instructions to set up and run the AquaSense360 project on a new laptop or desktop computer.

## Prerequisites

Before starting, ensure the new computer has the following software installed:

1. **Node.js** (v18 or v20 recommended)
   - Download: [https://nodejs.org/](https://nodejs.org/)
   - Verify installation in terminal: `node -v` and `npm -v`
2. **Python** (v3.9 to v3.11 recommended)
   - Download: [https://www.python.org/downloads/](https://www.python.org/downloads/)
   - Verify installation in terminal: `python --version`

---

## Step 1: Transfer Project Files

1. Copy the entire `auqa360` folder from your old computer to the new one.
2. **IMPORTANT**: Do NOT copy the `node_modules` folders or the `ml-service/.venv` folder. These are tied to the specific operating system and must be recreated on the new machine.

---

## Step 2: Install Node.js Dependencies

Open a terminal inside the main `auqa360` folder and run the following commands sequentially:

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to root directory
cd ..
```

---

## Step 3: Configure IP Addresses (Crucial for Mobile Access)

If you intend to access the dashboard from a mobile phone on the same Wi-Fi network:

1. Find the **IPv4 address** of the *new* computer.
   - On Windows: Open Command Prompt and type `ipconfig`. Look for the "IPv4 Address" under your Wi-Fi or Ethernet adapter.
   - Example: `192.168.43.50`

2. Open `backend/.env` in a text editor and update the `FRONTEND_URL`:
   ```env
   # Replace with your new IP
   FRONTEND_URL=http://<NEW_LAPTOP_IP>:3000
   ```

3. Open `frontend/.env` in a text editor and update the API URLs:
   ```env
   # Replace with your new IP
   REACT_APP_API_URL=http://<NEW_LAPTOP_IP>:5000/api
   REACT_APP_SOCKET_URL=http://<NEW_LAPTOP_IP>:5000
   ```

*(Note: If you only plan to view the dashboard on the laptop itself, you can leave these as `http://localhost:3000` and `http://localhost:5000` in the respective files).*

---

## Step 4: Set up the Python ML Service

Open a new terminal specifically inside the `auqa360/ml-service` folder.

1. **Create a fresh virtual environment:**
   ```bash
   python -m venv .venv
   ```

2. **Activate the virtual environment:**
   - **On Windows:**
     ```bash
     .venv\Scripts\activate
     ```
   - **On Mac/Linux:**
     ```bash
     source .venv/bin/activate
     ```
   *(You should see `(.venv)` prefix in your terminal prompt)*

3. **Install the required Python packages:**
   ```bash
   pip install -r requirements.txt
   ```
   *(This step may take several minutes as it downloads heavy packages like PyTorch, YOLO, and OpenCV).*

---

## Step 5: Start the System

Once everything is installed and configured, you boot the system exactly as you normally do.

**Terminal 1 (Backend & Frontend):**
Open a terminal in the main root folder (`auqa360/`) and run:
```bash
npm start
```
*(This will start both the backend server on port 5000 and the React frontend on port 3000 concurrently).*

**Terminal 2 (AI/ML Service):**
Open a terminal in the `auqa360/ml-service/` folder, ensure the virtual environment is activated, and run:
```bash
python main.py
```

---

### External Services Addendum
Because your system uses **MongoDB Atlas Cloud** for the database and **HiveMQ Public Broker** (`broker.hivemq.com:1883`) for IoT communication, you do **not** need to set up a local database or MQTT broker on the new computer. The ESP32 hardware will automatically find the new laptop's backend via the public cloud broker.
