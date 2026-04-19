// ESLint flat config — kun fokuseret på udefinerede identifiers.
// Formål: fange "ReferenceError: X is not defined" ved lint i stedet for ved runtime.
// Style/formatting-regler er bevidst ikke aktiveret for at holde signal-til-støj højt.
import js from "@eslint/js";
import react from "eslint-plugin-react";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: { react },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
        // XLSX er loaded via <script> eller lignende i index.html, ikke via import
        XLSX: "readonly",
      },
    },
    settings: {
      react: { version: "18" },
    },
    rules: {
      // PRIMÆRT FOKUS: fang udefinerede identifiers
      "no-undef": "error",
      "react/jsx-no-undef": "error",

      // Slå alt andet fra — vi vil ikke have style-støj, bare reference-sikkerhed
      "no-unused-vars": "off",
      "no-empty": "off",
      "no-useless-escape": "off",
      "no-prototype-builtins": "off",
      "no-cond-assign": "off",
      "no-constant-condition": "off",
      "no-fallthrough": "off",
      "no-control-regex": "off",
      "no-misleading-character-class": "off",
      "no-sparse-arrays": "off",
      "no-case-declarations": "off",
      "no-inner-declarations": "off",
      "no-irregular-whitespace": "off",
      "valid-typeof": "off",
      "no-func-assign": "off",
      "no-self-assign": "off",
      "no-unsafe-optional-chaining": "off",
      "no-undef-init": "off",
      "getter-return": "off",
      "no-useless-catch": "off",
      "no-async-promise-executor": "off",
      "no-dupe-keys": "off",
      "no-redeclare": "off",
    },
  },
  {
    // Filer uden for src/ (fx root-niveau) ignoreres — PlanMedFull 1.jsx er nu renamed væk
    ignores: ["node_modules/**", "dist/**", ".vite/**", ".claude/**"],
  },
];
