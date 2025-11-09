# AWS Amplify Deployment Guide

This guide will help you deploy the Fraud Detection React interface to AWS Amplify.

## Prerequisites

1. **AWS Account** - You need an active AWS account
2. **GitHub/GitLab/Bitbucket Account** - Your code should be in a Git repository
3. **Backend Deployment** - Your backend server should be deployed and accessible (e.g., AWS Elastic Beanstalk, EC2, etc.)

## Step 1: Prepare Your Repository

1. Make sure your code is committed and pushed to your Git repository (GitHub, GitLab, or Bitbucket)
2. Ensure the `amplify.yml` file is in the root of your `fraud-detection-ui` directory

## Step 2: Deploy Backend First

Before deploying the frontend, make sure your backend is deployed and accessible. You can deploy it to:
- AWS Elastic Beanstalk
- AWS EC2
- AWS Lambda + API Gateway
- Any other hosting service

**Note:** You'll need the backend URL for the next step.

## Step 3: Create AWS Amplify App

1. **Sign in to AWS Console**
   - Go to [AWS Console](https://console.aws.amazon.com/)
   - Navigate to **AWS Amplify** service

2. **Create New App**
   - Click **"New app"** → **"Host web app"**
   - Choose your Git provider (GitHub, GitLab, Bitbucket, or AWS CodeCommit)
   - Authorize AWS Amplify to access your repository

3. **Select Repository**
   - Choose your repository
   - Select the branch (usually `main` or `master`)
   - **Important:** Set the root directory to `fraud-detection-ui` (not the project root)

4. **Configure Build Settings**
   - AWS Amplify should auto-detect the `amplify.yml` file
   - If not, you can manually configure:
     ```yaml
     version: 1
     frontend:
       phases:
         preBuild:
           commands:
             - npm ci
         build:
           commands:
             - npm run build
       artifacts:
         baseDirectory: build
         files:
           - '**/*'
       cache:
         paths:
           - node_modules/**/*
     ```

5. **Add Environment Variables**
   - Click **"Advanced settings"**
   - Add environment variable:
     - **Key:** `REACT_APP_API_URL`
     - **Value:** Your deployed backend URL (e.g., `https://your-backend.elasticbeanstalk.com` or `https://api.yourdomain.com`)
   - Click **"Save"**

6. **Review and Deploy**
   - Review your settings
   - Click **"Save and deploy"**

## Step 4: Wait for Deployment

- AWS Amplify will:
  1. Clone your repository
  2. Install dependencies (`npm ci`)
  3. Build your React app (`npm run build`)
  4. Deploy to AWS CDN
  5. Provide you with a URL (e.g., `https://main.xxxxx.amplifyapp.com`)

## Step 5: Configure Custom Domain (Optional)

1. In Amplify Console, go to **"Domain management"**
2. Click **"Add domain"**
3. Enter your domain name
4. Follow the DNS configuration instructions
5. Wait for SSL certificate provisioning (automatic)

## Step 6: Update Backend CORS (If Needed)

If your backend is on a different domain, make sure CORS is configured to allow requests from your Amplify domain:

```javascript
// In your backend server.js
const cors = require('cors');
app.use(cors({
  origin: [
    'http://localhost:3000', // Local development
    'https://your-amplify-app.amplifyapp.com', // Amplify domain
    'https://your-custom-domain.com' // Custom domain
  ]
}));
```

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `REACT_APP_API_URL` | Backend API URL | `https://api.example.com` |

## Troubleshooting

### Build Fails
- Check the build logs in Amplify Console
- Ensure `amplify.yml` is correct
- Verify all dependencies are in `package.json`

### API Calls Fail
- Verify `REACT_APP_API_URL` is set correctly
- Check backend CORS configuration
- Ensure backend is accessible from the internet

### Styling Issues
- Make sure Tailwind CSS is properly configured
- Check that `tailwind.config.js` includes all necessary paths

## Continuous Deployment

AWS Amplify automatically deploys when you push to your connected branch. You can:
- Set up branch-specific deployments
- Configure preview deployments for pull requests
- Set up manual deployments for specific branches

## Cost Estimation

- **AWS Amplify Free Tier:**
  - 1,000 build minutes/month
  - 15 GB storage
  - 5 GB served/month
- **Beyond Free Tier:**
  - Build: $0.01 per build minute
  - Hosting: $0.15 per GB served

## Support

For more information, visit:
- [AWS Amplify Documentation](https://docs.aws.amazon.com/amplify/)
- [Amplify Console](https://console.aws.amazon.com/amplify/)

