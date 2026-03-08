import { fileSystem } from '#app/modules/agent-core/agent-core.files'

export async function validateFrontendFiles(runId: string, files: string[]): Promise<{
  valid: boolean
  errors: string[]
  warnings: string[]
}> {
  const safeReadFile = async (relativePath: string): Promise<string> => {
    try {
      return await fileSystem.readFile(runId, relativePath)
    } catch {
      return ''
    }
  }

  const errors: string[] = []
  const warnings: string[] = []

  const required = [
    'frontend/package.json',
    'frontend/index.html',
    'frontend/public/robots.txt',
    'frontend/public/sitemap.xml',
    'frontend/src/main.tsx',
    'frontend/src/App.tsx',
  ]
  for (const f of required) {
    if (!files.includes(f)) errors.push(`Missing required file: ${f}`)
  }

  const pkgContent = await safeReadFile('frontend/package.json')
  if (pkgContent) {
    try {
      const pkg = JSON.parse(pkgContent)
      if (!pkg.scripts?.dev) errors.push('package.json missing scripts.dev')
      if (!pkg.scripts?.build) errors.push('package.json missing scripts.build')
      if (!pkg.dependencies?.react) errors.push('package.json missing react dependency')
      if (!pkg.devDependencies?.vite && !pkg.dependencies?.vite) {
        errors.push('package.json missing vite')
      }
      if (!pkg.name) warnings.push('package.json missing project name')
      if (!pkg.description) warnings.push('package.json missing description (recommended for maintainability/SEO context)')

      const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
      if (!allDeps.motion && !allDeps['framer-motion']) {
        errors.push('package.json missing animation library dependency (motion or framer-motion)')
      }
    } catch {
      errors.push('package.json is not valid JSON')
    }
  }

  const indexContent = await safeReadFile('frontend/index.html')
  if (indexContent) {
    if (!/<title>[^<]+<\/title>/i.test(indexContent)) {
      errors.push('index.html missing non-empty <title>')
    }
    if (!/<meta[^>]+name=["']description["'][^>]*>/i.test(indexContent)) {
      errors.push('index.html missing meta description')
    }
    if (!/<link[^>]+rel=["']canonical["'][^>]*>/i.test(indexContent)) {
      warnings.push('index.html missing canonical link tag')
    }
    if (!/<meta[^>]+property=["']og:title["'][^>]*>/i.test(indexContent)) {
      warnings.push('index.html missing Open Graph title tag')
    }
    if (!/<meta[^>]+name=["']twitter:card["'][^>]*>/i.test(indexContent)) {
      warnings.push('index.html missing Twitter card meta tag')
    }
    if (/lorem ipsum|your company|coming soon/i.test(indexContent)) {
      warnings.push('index.html appears to include placeholder/generic copy')
    }
  }

  const robotsContent = await safeReadFile('frontend/public/robots.txt')
  if (robotsContent && !/User-agent:/i.test(robotsContent)) {
    warnings.push('robots.txt exists but does not contain User-agent directive')
  }

  const sitemapContent = await safeReadFile('frontend/public/sitemap.xml')
  if (sitemapContent && !/<urlset[\s>]/i.test(sitemapContent)) {
    errors.push('sitemap.xml exists but does not contain a valid <urlset>')
  }

  const appContent = await safeReadFile('frontend/src/App.tsx')
  if (appContent) {
    if (!/<main[\s>]/i.test(appContent)) {
      warnings.push('App.tsx missing <main> landmark')
    }
    if (!/<h1[\s>]/i.test(appContent)) {
      warnings.push('App.tsx missing primary <h1> heading')
    }
    if (!/<(header|section|footer)[\s>]/i.test(appContent)) {
      warnings.push('App.tsx missing semantic sectioning elements (header/section/footer)')
    }
    if (/lorem ipsum|your company|coming soon|revolutionary|cutting-edge/i.test(appContent)) {
      warnings.push('App.tsx copy may sound generic/placeholder; improve brand wording')
    }
  }

  const cssContent = await safeReadFile('frontend/src/index.css')
  if (cssContent) {
    const hasFontImport = /fonts\.googleapis\.com|@font-face/i.test(cssContent)
    const hasFontFamily = /font-family\s*:/i.test(cssContent)
    if (!hasFontFamily) {
      warnings.push('index.css missing explicit font-family declarations')
    }
    if (!hasFontImport) {
      warnings.push('No custom web font import detected (Google Fonts or @font-face)')
    }
    if (/font-family:\s*(system-ui|Arial|sans-serif)\s*;?/i.test(cssContent) && !hasFontImport) {
      warnings.push('Typography looks default/system-only; use more distinctive fonts')
    }
  }

  if (!files.some(f => f.startsWith('frontend/src/components/'))) {
    warnings.push('No files found in frontend/src/components (consider modular component structure)')
  }

  if (!files.includes('frontend/vite.config.ts') && !files.includes('frontend/vite.config.js')) {
    warnings.push('No vite.config found — WebContainer may not boot')
  }

  return { valid: errors.length === 0, errors, warnings }
}

export function normalizePrdMarkdown(content: string, inputText: string): string {
  const cleaned = content
    .replace(/```(?:markdown|md)?/gi, '')
    .replace(/```/g, '')
    .trim()

  if (cleaned.startsWith('#')) {
    return cleaned
  }

  return `# Product Requirements Document\n\n## Request\n${inputText}\n\n${cleaned}`
}
