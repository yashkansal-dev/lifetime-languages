# lifetime-languages

![Tech Stack Analytics](https://lifetime-languages.vercel.app/api/languages)

## Environment variable setup (Vercel)

Set one of these environment variables in your Vercel project:

- `GITHUB_TOKEN`
- `GH_TOKEN`
- `GITHUB_PAT`
- `GITHUB_ACCESS_TOKEN`

Token requirements:

- Must be a valid GitHub personal access token.
- Token should include permission to read repositories and language stats.

Important:

- Add the variable to the same environment you are deploying (`Production`, `Preview`, or `Development`).
- Redeploy after adding or changing environment variables.