import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ToolHandler, ToolResult } from '#app/agents/skills/skill.types'

/**
 * generate_smart_contract — Sam scaffolds smart contracts.
 */
export const generateSmartContractHandler: ToolHandler = {
  name: 'generate_smart_contract',
  description: 'Generate Anchor/Solana smart contract scaffold',
  allowedRoles: ['be_sc'],
  producesFiles: true,

  async execute(params, context): Promise<ToolResult> {
    const name = params.name as string || 'basic_program'
    const contractDir = join(context.workspacePath, 'anchor/programs', name, 'src')
    const libRsPath = join(contractDir, 'lib.rs')

    const content = `use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111");

#[program]
pub mod ${name} {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
`

    try {
      mkdirSync(contractDir, { recursive: true })
      writeFileSync(libRsPath, content, 'utf-8')

      return {
        success: true,
        data: { name, libRsPath },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Smart contract scaffold failed',
      }
    }
  },
}
