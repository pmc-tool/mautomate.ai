const c = require("ansi-colors");

// Multi-tenant mode resolves the publishable key per request (from the Host ->
// tenant), so there is no single build-time key to require. See src/lib/tenant.ts.
const MULTI_TENANT =
  process.env.MULTI_TENANT === "1" || process.env.MULTI_TENANT === "true";

const requiredEnvs = MULTI_TENANT
  ? []
  : [
      {
        key: "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY",
        // TODO: we need a good doc to point this to
        description:
          "Learn how to create a publishable key: https://docs.medusajs.com/v2/resources/storefront-development/publishable-api-keys",
      },
    ];

function checkEnvVariables() {
  const missingEnvs = requiredEnvs.filter(function (env) {
    c;
    return !process.env[env.key];
  });

  if (missingEnvs.length > 0) {
    console.error(
      c.red.bold("\n🚫 Error: Missing required environment variables\n")
    );

    missingEnvs.forEach(function (env) {
      console.error(c.yellow(`  ${c.bold(env.key)}`));
      if (env.description) {
        console.error(c.dim(`    ${env.description}\n`));
      }
    });

    console.error(
      c.yellow(
        "\nPlease set these variables in your .env file or environment before starting the application.\n"
      )
    );

    process.exit(1);
  }
}

module.exports = checkEnvVariables;
