import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Pin the root explicitly. typescript-eslint v8 auto-infers
    // `tsconfigRootDir`, which errors when multiple candidate roots exist
    // (repo root + each `samples/*` with its own tsconfig.json).
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    settings: { react: { version: "detect" } },
    rules: {
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/rules-of-hooks": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      eqeqeq: ["warn", "always"],
      "require-yield": "warn",
      "@typescript-eslint/no-this-alias": "warn",
      "no-debugger": "error",
      "prefer-const": "error",
      "no-console": "warn",
    },
  },
  prettierConfig,
  { ignores: ["dist/", "node_modules/", "coverage/"] }
);
