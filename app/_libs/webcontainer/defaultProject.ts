import type { FileSystemTree } from "@webcontainer/api";

const DEFAULT_APP_CONTENT = `export default function App() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.5rem',
        padding: '2rem',
        background: 'linear-gradient(160deg, #faf8f6 0%, #f0ebe6 40%, #ebe3dc 100%)',
        fontFamily: '"Silkscreen", "Press Start 2P", monospace',
        color: '#613f26',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          padding: '2.5rem 3rem',
          borderRadius: '0.625rem',
          background: '#b8b0ae',
          border: '1px solid #a8a19f',
          boxShadow: '6px 6px 0 0 #827b79 inset',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 'clamp(1.25rem, 4vw, 2rem)',
            fontFamily: '"Press Start 2P", "Silkscreen", monospace',
            letterSpacing: '0.02em',
            background: 'linear-gradient(135deg, #613f26 0%, #8b5a3c 40%, #ffbc8d 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Claw Cartel
        </h1>
        <p
          style={{
            margin: '1rem 0 0',
            fontSize: '0.875rem',
            fontFamily: '"Silkscreen", "Press Start 2P", monospace',
            color: 'rgba(97,63,38,0.75)',
          }}
        >
          Edit the code → preview updates live.
        </p>
        <div
          style={{
            marginTop: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            fontFamily: '"Silkscreen", monospace',
            fontSize: '0.75rem',
            color: 'rgba(97,63,38,0.55)',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ffbc8d', animation: 'pulse 1.5s ease-in-out infinite' }} />
          Ready
        </div>
      </div>
    </main>
  );
}
`;

export const defaultPageContent = DEFAULT_APP_CONTENT;

const GLOBALS_CSS = `@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Silkscreen:wght@400;700&display=swap');

* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: 'Silkscreen', 'Press Start 2P', monospace;
  -webkit-font-smoothing: none;
  -moz-osx-font-smoothing: unset;
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.9); }
}
`;

export const defaultProject: FileSystemTree = {
  "package.json": {
    file: {
      contents: JSON.stringify(
        {
          name: "claw-cartel",
          private: true,
          version: "0.0.0",
          type: "module",
          scripts: {
            dev: "vite",
            build: "vite build",
            preview: "vite preview",
          },
          dependencies: {
            react: "^18.2.0",
            "react-dom": "^18.2.0",
          },
          devDependencies: {
            "@vitejs/plugin-react": "^4.2.1",
            vite: "^5.0.0",
          },
        },
        null,
        2
      ),
    },
  },
  "index.html": {
    file: {
      contents: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Claw Cartel</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    },
  },
  "vite.config.js": {
    file: {
      contents: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
});
`,
    },
  },
  "tsconfig.json": {
    file: {
      contents: `{
  "compilerOptions": {
    "target": "es2020",
    "useDefineForClassFields": true,
    "lib": ["es2020", "dom", "dom.iterable"],
    "module": "esnext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
`,
    },
  },
  src: {
    directory: {
      "main.tsx": {
        file: {
          contents: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
        },
      },
      "App.tsx": {
        file: {
          contents: DEFAULT_APP_CONTENT,
        },
      },
      "index.css": {
        file: {
          contents: GLOBALS_CSS,
        },
      },
    },
  },
};
