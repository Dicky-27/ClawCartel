import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { ToolHandler, ToolResult } from '#app/agents/skills/skill.types'

/**
 * create_component — Jordan scaffolds a new React component.
 */
export const createComponentHandler: ToolHandler = {
  name: 'create_component',
  description: 'Create a new React component file with styles',
  allowedRoles: ['fe'],
  producesFiles: true,

  async execute(params, context): Promise<ToolResult> {
    const name = params.name as string
    if (!name) return { success: false, error: 'Component name is required' }

    const componentPath = join(context.workspacePath, 'frontend/src/components', `${name}.tsx`)
    const cssPath = join(context.workspacePath, 'frontend/src/components', `${name}.module.css`)

    const componentContent = `import styles from './${name}.module.css'

interface ${name}Props {
  // Define props here
}

export const ${name} = (props: ${name}Props) => {
  return (
    <div className={styles.container}>
      <h1>${name} Component</h1>
    </div>
  )
}

export default ${name}
`

    const cssContent = `.container {
  padding: 1rem;
}
`

    try {
      mkdirSync(dirname(componentPath), { recursive: true })
      writeFileSync(componentPath, componentContent, 'utf-8')
      writeFileSync(cssPath, cssContent, 'utf-8')

      return {
        success: true,
        data: { name, componentPath, cssPath },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Component creation failed',
      }
    }
  },
}
