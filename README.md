# CLICKER Hub | GitHub Deployment Guide

This repository is configured to automatically host the **CLICKER** frontend on **GitHub Pages**.

## 🚀 How to Host on GitHub

1.  **Push to GitHub**: Initialize a Git repository and push your code to GitHub:
    ```bash
    git init
    git add .
    git commit -m "Initial commit"
    git branch -M main
    git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
    git push -u origin main
    ```
2.  **Enable GitHub Pages**:
    - Go to your repository **Settings > Pages**.
    - Under **Build and deployment > Source**, ensure **GitHub Actions** is selected.
    - The app will automatically deploy to `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`.

## 🌐 Connecting the Backend

Since GitHub Pages only hosts static files, your video database (`data.json`) must remain on your local PC.

1.  **Start your Local Server**: Run `server.ps1` on your PC.
2.  **Expose your Server**: Use a tool like **localtunnel** or **ngrok** to get a public URL for your local server (port 3000).
    - Example: `lt --port 3000` -> `https://cyan-monkeys-jump.loca.lt`
3.  **Update the App**:
    - Open your GitHub-hosted website.
    - Go to **Admin > Network Config**.
    - Enter your public tunnel URL (or your local IP if testing on the same Wi-Fi).
    - Save and Reconnect.

## 🧪 Development
- Run `server.ps1` for local development with hot-reload.
- Edits in the `public/` folder will be automatically synced to GitHub on every push.
