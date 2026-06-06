import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";

const strictRules = {
  "array-callback-return": "error",
  "consistent-return": "error",
  "default-case": "error",
  "dot-notation": "error",
  eqeqeq: ["error", "always"],
  "no-alert": "error",
  "no-caller": "error",
  "no-console": "warn",
  "no-else-return": ["error", { allowElseIf: false }],
  "no-implicit-coercion": "error",
  "no-implied-eval": "error",
  "no-lonely-if": "error",
  "no-multi-assign": "error",
  "no-return-await": "error",
  "no-shadow": "error",
  "no-throw-literal": "error",
  "no-undef-init": "error",
  "no-unneeded-ternary": "error",
  "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  "no-use-before-define": ["error", { functions: false, classes: true, variables: true }],
  "object-shorthand": ["error", "always"],
  "prefer-arrow-callback": "error",
  "prefer-const": "error",
  "prefer-destructuring": [
    "error",
    {
      array: false,
      object: true
    }
  ],
  "prefer-object-has-own": "error",
  "prefer-template": "error",
  radix: "error",
  "require-await": "error"
};

const baseLanguageOptions = {
  ecmaVersion: "latest",
  sourceType: "module",
  globals: {
    ...globals.node,
    ...globals.jest,
    fetch: "readonly"
  }
};

export default defineConfig([
  {
    ignores: ["node_modules/**", "coverage/**"]
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,ts}"],
    languageOptions: baseLanguageOptions,
    rules: strictRules
  },
  {
    files: ["wallaby.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node
      }
    }
  }
]);
