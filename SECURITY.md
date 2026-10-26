# Security

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's **Report a vulnerability** button under the
repository's **Security** tab (private vulnerability reporting), or message [@HaggsField](https://x.com/HaggsField) on X
and ask for a private way to send details.

Include what you found, how to reproduce it and what it lets someone do. You will get an answer within a few days, and a
fix or a plan as soon as there is one. Please give us a reasonable time to fix it before you share it more widely.

## What matters most here

- **Keys.** haggs never sends a key anywhere except the provider it belongs to. Keys live in the browser's own storage or
  server-side environment variables, and are not written to the repository. If you find a path that logs, returns or
  forwards a key, that is a vulnerability.
- **Files.** The development server reads files only from the folder named by `HAGGS_LOCAL_MEDIA`. A way out of that
  folder is a vulnerability.
- **Network reach.** "Your own GPU" accepts only loopback and private-network addresses. Server code that fetches a link
  refuses private addresses. A way around either is a vulnerability.
- **Accounts.** Sign-in, the credits ledger and the Stripe webhook run on the hosted site. Anything that lets one account
  see or spend another's data or credits is a vulnerability.

## Supported versions

Only the latest commit on the default branch is supported.
