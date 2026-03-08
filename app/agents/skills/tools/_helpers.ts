/**
 * Shared helpers used by multiple tool handlers.
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import Logger from '#app/utils/logger'

export function execInWorkspace(workspacePath: string, command: string, timeoutMs = 60000): string {
  if (!existsSync(workspacePath)) {
    mkdirSync(workspacePath, { recursive: true })
  }

  Logger.info({ workspacePath, command }, 'Executing command in workspace')

  try {
    const output = execSync(command, {
      cwd: workspacePath,
      timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, npm_config_yes: 'true' },
    })

    return output.toString()
  } catch (error: any) {
    const stderr = error.stderr?.toString() || ''
    const stdout = error.stdout?.toString() || ''
    Logger.error({ command, stderr, stdout }, 'Workspace command failed')
    throw new Error(`Command failed: ${command}\n${stderr || stdout}`)
  }
}

export function writeViteReactTsFallback(projectDir: string): string[] {
  const files: Record<string, string> = {
    'package.json': JSON.stringify({
      name: 'frontend',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc -b && vite build',
        preview: 'vite preview',
      },
      dependencies: {
        react: '^18.3.1',
        'react-dom': '^18.3.1',
      },
      devDependencies: {
        '@types/react': '^18.3.3',
        '@types/react-dom': '^18.3.0',
        '@vitejs/plugin-react': '^4.3.1',
        typescript: '^5.6.3',
        vite: '^5.4.10',
      },
    }, null, 2),
    'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Claw Cartel Frontend</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        useDefineForClassFields: true,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'Bundler',
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
      },
      include: ['src'],
    }, null, 2),
    'vite.config.ts': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
`,
    'src/main.tsx': `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`,
    'src/App.tsx': `export default function App() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Frontend Scaffold Ready</h1>
      <p>Jordan can now replace this with project-specific UI.</p>
    </main>
  )
}
`,
    'src/index.css': `:root {
  font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}
`,
  }

  const writtenFiles: string[] = []
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = join(projectDir, relativePath)
    const parentDir = dirname(fullPath)
    mkdirSync(parentDir, { recursive: true })
    writeFileSync(fullPath, content, 'utf-8')
    writtenFiles.push(relativePath)
  }

  return writtenFiles
}

export { mkdirSync, writeFileSync, dirname, join, Logger }
