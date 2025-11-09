# AWS Amplify Deployment Checklist

## Pre-Deployment

- [ ] Code is committed and pushed to Git repository
- [ ] Backend is deployed and accessible
- [ ] Backend URL is ready (for environment variable)
- [ ] `amplify.yml` file exists in `fraud-detection-ui` directory
- [ ] All dependencies are in `package.json`
- [ ] Application builds successfully locally (`npm run build`)

## Deployment Steps

- [ ] Sign in to AWS Console
- [ ] Navigate to AWS Amplify service
- [ ] Create new app → Host web app
- [ ] Connect Git repository
- [ ] **Set root directory to `fraud-detection-ui`** ⚠️ IMPORTANT
- [ ] Configure build settings (should auto-detect `amplify.yml`)
- [ ] Add environment variable:
  - Key: `REACT_APP_API_URL`
  - Value: Your backend URL (e.g., `https://your-backend.elasticbeanstalk.com`)
- [ ] Review and deploy
- [ ] Wait for build to complete
- [ ] Test the deployed application

## Post-Deployment

- [ ] Verify application loads correctly
- [ ] Test API connection (try a prediction)
- [ ] Check browser console for errors
- [ ] (Optional) Configure custom domain
- [ ] (Optional) Set up branch-specific deployments

## Common Issues

- **Build fails:** Check build logs, verify `amplify.yml` syntax
- **API calls fail:** Verify `REACT_APP_API_URL` is set correctly
- **Styling broken:** Check Tailwind CSS configuration
- **CORS errors:** Update backend CORS to include Amplify domain

## Quick Commands

```bash
# Test build locally
cd fraud-detection-ui
npm install
npm run build

# Check if build directory is created
ls -la build/
```

