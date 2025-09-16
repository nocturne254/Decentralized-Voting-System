# GitHub Secrets Configuration

This document lists all the GitHub secrets that need to be configured in your repository settings for the CI/CD pipeline to work properly.

## Required Secrets

Navigate to your GitHub repository → Settings → Secrets and variables → Actions, then add these secrets:

### Security & Testing
- **`SNYK_TOKEN`** - Token for Snyk security scanning (optional, pipeline continues without it)
  - Get from: https://snyk.io/account/
  - Used for: Vulnerability scanning of dependencies

### Docker Registry
- **`DOCKERHUB_USERNAME`** - Your Docker Hub username
- **`DOCKERHUB_TOKEN`** - Docker Hub access token (not password)
  - Get from: Docker Hub → Account Settings → Security → New Access Token
  - Used for: Pushing Docker images to registry

### Production Deployment
- **`PROD_API_KEY`** - Production API key for the voting system
- **`PROD_DATABASE_URL`** - Production database connection string
  - Format: `mysql://username:password@host:port/database`
  - Used for: Production deployment configuration

### Notifications
- **`SLACK_WEBHOOK_URL`** - Slack webhook URL for deployment notifications
  - Get from: Slack → Apps → Incoming Webhooks
  - Used for: Sending deployment status notifications

### Performance Testing
- **`LIGHTHOUSE_TOKEN`** - GitHub App token for Lighthouse CI
  - Get from: https://github.com/apps/lighthouse-ci
  - Used for: Performance testing and reporting

### Package Publishing
- **`NPM_PUBLISH_TOKEN`** - NPM token for publishing packages
  - Get from: npmjs.com → Access Tokens → Generate New Token
  - Used for: Publishing SDK packages to NPM registry

## Optional Secrets

These secrets are optional and the pipeline will work without them:

- **`CODECOV_TOKEN`** - For code coverage reporting
- **`SONAR_TOKEN`** - For SonarQube code quality analysis

## Setting Up Secrets

1. Go to your GitHub repository
2. Click on **Settings** tab
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Add each secret with the exact name listed above
6. Save each secret

## Environment-Specific Secrets

For different environments, you may want to create environment-specific secrets:

### Staging Environment
- `STAGING_API_KEY`
- `STAGING_DATABASE_URL`
- `STAGING_SLACK_WEBHOOK`

### Development Environment
- `DEV_API_KEY`
- `DEV_DATABASE_URL`

## Security Best Practices

1. **Never commit secrets to code** - Always use GitHub secrets
2. **Use least privilege** - Give tokens only the permissions they need
3. **Rotate regularly** - Update tokens and secrets periodically
4. **Monitor usage** - Check secret usage in Actions logs
5. **Use environment protection** - Set up environment protection rules for production

## Troubleshooting

### Common Issues

1. **Secret not found**: Ensure the secret name matches exactly (case-sensitive)
2. **Permission denied**: Check that the token has the required permissions
3. **Invalid format**: Verify the secret format (especially for database URLs)

### Testing Secrets

You can test if secrets are properly configured by:

1. Running the workflow manually
2. Checking the Actions logs for authentication errors
3. Using the `echo` command with masked output to verify secret presence

### Example Secret Values

```bash
# Docker Hub
DOCKERHUB_USERNAME=myusername
DOCKERHUB_TOKEN=dckr_pat_1234567890abcdef

# Database URL
PROD_DATABASE_URL=mysql://voting_user:secure_password@db.example.com:3306/voting_prod

# Slack Webhook
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX

# NPM Token
NPM_PUBLISH_TOKEN=npm_1234567890abcdef1234567890abcdef12345678
```

## Validation

After setting up all secrets, trigger a workflow run to validate the configuration. Check the Actions tab for any authentication or permission errors.

The CI/CD pipeline is designed to be resilient - it will continue even if some optional secrets are missing, but core functionality requires the production deployment secrets to be properly configured.
