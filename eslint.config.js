import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import unusedImports from 'eslint-plugin-unused-imports'

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    plugins: {
      'unused-imports': unusedImports
    },
    files: [
      '**/*.ts',
      '**/*.js',
    ],
    rules: {
      'semi': ['error', 'never'],
      'no-extra-semi': 'error',
      'indent': ['error', 2],
      'eol-last': 'error',
      'func-call-spacing': 'error',
      'newline-before-return': 'error',
      'no-multi-spaces': 'error',
      'no-multiple-empty-lines': 'error',
      'space-before-blocks': 'error',
      'no-trailing-spaces': 'error',
      'template-curly-spacing': 'error',
      'constructor-super': 'error',
      'getter-return': 'error',
      'no-compare-neg-zero': 'error',
      'no-const-assign': 'error',
      'no-duplicate-imports': 'error',
      'camelcase': 'error',
      'default-case': 'error',
      'no-empty': 'error',
      'no-empty-function': 'error',
      'no-unused-expressions': 'error',
      'no-useless-return': 'error',
      'no-var': 'error',
      'require-await': 'error',
      'quotes': ['error', 'single'],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'no-restricted-imports': [
        'error',
        {
          'patterns': ['../*', './*'],
        },
      ],
    },
  }
)
