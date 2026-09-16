# AI Stock Metadata & Tag Generator Pro 🚀

AI-powered professional SEO title, description, keyword generator, and direct-to-disk metadata embedder for stock creators (Adobe Stock, Shutterstock, Getty Images, Freepik, Pond5).

---

## ✨ Key Features

- **Multi-Format Support**:
  - **Images**: JPEG, JPG, PNG, WEBP (with internal EXIF / IPTC / Adobe XMP & Windows Explorer 5-Star Rating).
  - **Videos**: MP4, MOV, M4V (with native Windows Explorer Properties `Details` tab support for Title, Subtitle, 5-Star Rating, Tags, and Comments via QuickTime `ilst`, 3GPP `titl`/`dscp`/`kywd`, and Adobe XMP atoms).
  - **Vectors**: EPS, AI, SVG (with PostScript DSC comments & XMP headers).
- **Direct In-Place Disk Renaming & Saving**:
  - Direct local folder connection via File System Access API.
  - Automatically renames the original files and embeds metadata directly inside each file **without downloading duplicate copies or redundant `.xmp` sidecars**.
- **AI Models Supported**:
  - Google Gemini (Gemini 2.5 Flash / Pro)
  - Groq (Llama 3 Vision)
  - Mistral AI
- **Marketplace Presets**:
  - Adobe Stock, Shutterstock, Getty / iStock, Freepik, Pond5.
  - CSV metadata export matching all major stock platform schemas.
  - Automation scripts for Adobe Photoshop & Illustrator (`.jsx`).

---

## 🛠️ Installation & Local Development

1. **Clone the repository**:
   ```bash
   git clone <YOUR_GITHUB_REPOSITORY_URL>
   cd ai-stock-metadata-pro
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your web browser (Google Chrome or Microsoft Edge recommended for full disk folder access).

---

## 🚀 Pushing to GitHub (গিটহাবে আপলোড করার নিয়ম)

To push this codebase to your own GitHub account:

1. **Create a new repository** on [GitHub](https://github.com/new) (e.g. named `stock-metadata-generator`). Leave it empty (do NOT check "Initialize with README").
2. **Run the following commands** in your terminal inside this project folder:

```bash
# Add your GitHub repository as the remote origin
git remote add origin https://github.com/<YOUR-USERNAME>/<YOUR-REPO-NAME>.git

# Push your code to GitHub main branch
git push -u origin main
```

---

## 🔒 Security & Environment Variables

Create a `.env` file in the project root if you prefer to load API keys via environment variables instead of the in-app settings UI:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
MISTRAL_API_KEY=your_mistral_api_key_here
```
*(Never commit your `.env` file to GitHub)*

