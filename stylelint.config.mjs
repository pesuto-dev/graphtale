/** @type {import("stylelint").Config} */
export default {
  extends: ["stylelint-config-standard"],
  ignoreFiles: ["dist/**", "node_modules/**"],
  rules: {
    // Compact nodes and high contrast repeat earlier selectors on purpose.
    // Reordering those blocks to satisfy this rule can change the cascade.
    "no-descending-specificity": null,
    "selector-class-pattern": [
      "^([a-z][a-z0-9]*)(-[a-z0-9]+)*$|^react-flow(__[a-z0-9-]+)+$",
      {
        message:
          "Use a kebab-case class with a component prefix. React Flow's react-flow__* classes are the exception.",
      },
    ],
    "custom-property-pattern": [
      "^([a-z][a-z0-9]*)(-[a-z0-9]+)*$|^vscode-.+$",
      {
        message:
          "Design tokens are kebab-case custom properties. --vscode-* keeps the editor's token name.",
      },
    ],
  },
};
