# OSCE Masterclass – React + TypeScript (Vite)

This project is ready to deploy your typed React file as-is.

## Run locally
```bash
npm install
npm run dev
```

## Deploy to Netlify
- Build command: `npm run build`
- Publish directory: `dist`
- You can import from GitHub or drag the built `dist/` folder.

## Why TypeScript?
Your `App` uses React.FC and inline type annotations (e.g. `(completed:number)`), which fail in plain `.jsx` builds. This template compiles those TypeScript types without you changing the file.
