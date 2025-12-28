# Production Deployment Checklist

This checklist contains all tasks that need to be completed before the Backgammon Arena application goes live.

## Backend Services

- [ ] **Replace Flask Development Server with Production WSGI Server**
  - Current: Flask's built-in development server (`app.run()`)
  - Warning: "WARNING: This is a development server. Do not use it in a production deployment."
  - Solution: Use a production WSGI server like:
    - **Gunicorn** (recommended for most deployments)
    - **uWSGI**
    - **Waitress** (Windows-compatible)
  - Location: `backend/python_ai_service.py`
  - Action: Replace `app.run(host='0.0.0.0', port=5000, debug=True)` with production server configuration

- [ ] **Environment Variables Setup**
  - [ ] Move all sensitive configuration to environment variables
  - [ ] Ensure `.env` files are in `.gitignore`
  - [ ] Set up production environment variables on hosting platform
  - [ ] Verify no hardcoded secrets/API keys in code

- [ ] **Error Handling & Logging**
  - [ ] Set up proper error logging (not just console prints)
  - [ ] Configure log rotation
  - [ ] Set up error monitoring (e.g., Sentry, LogRocket)
  - [ ] Remove debug mode flags (`debug=True`)

- [ ] **Database Connection Security**
  - [ ] Verify Supabase connection uses service role key securely
  - [ ] Check Row Level Security (RLS) policies are properly configured
  - [ ] Test database connection pooling for production load

## Frontend

- [ ] **Build Optimization**
  - [ ] Run production build (`npm run build`)
  - [ ] Verify build output is optimized (minified, compressed)
  - [ ] Test production build locally before deploying

- [ ] **Environment Variables**
  - [ ] Set up production API endpoints in frontend environment variables
  - [ ] Ensure `VITE_BACKEND_URL` points to production backend
  - [ ] Remove any hardcoded localhost URLs

- [ ] **Performance Optimization**
  - [ ] Test loading times
  - [ ] Verify images/assets are optimized
  - [ ] Check bundle size and code splitting if needed

## Infrastructure & Hosting

- [ ] **Backend Hosting**
  - [ ] Choose hosting platform for Node.js backend (e.g., Railway, Render, Heroku, DigitalOcean)
  - [ ] Choose hosting platform for Python AI service (may need separate service)
  - [ ] Configure environment variables on hosting platform
  - [ ] Set up process manager (PM2, systemd, etc.) if needed
  - [ ] Configure auto-restart on crashes

- [ ] **Frontend Hosting**
  - [ ] Deploy to Vercel, Netlify, or similar
  - [ ] Configure custom domain (if applicable)
  - [ ] Set up SSL/HTTPS certificates

- [ ] **GNU Backgammon Installation on Production Server**
  - [ ] Ensure GNU Backgammon is installed on production server (if Python service runs on same server)
  - [ ] Or verify container/Docker setup includes GNU Backgammon
  - [ ] Test GNU Backgammon accessibility from Python service

## Security

- [ ] **API Security**
  - [ ] Implement rate limiting on API endpoints
  - [ ] Add CORS configuration for production domains only
  - [ ] Verify authentication/authorization is working correctly
  - [ ] Test for common vulnerabilities (SQL injection, XSS, etc.)

- [ ] **Data Protection**
  - [ ] Verify user passwords are hashed (not stored in plain text)
  - [ ] Check that sensitive data is encrypted in transit (HTTPS)
  - [ ] Review and test GDPR/compliance requirements (if applicable)

## Testing

- [ ] **End-to-End Testing**
  - [ ] Test all game modes (Pass and Play, vs CPU, Online)
  - [ ] Test user authentication flows
  - [ ] Test game creation and joining
  - [ ] Test error scenarios (network failures, invalid moves, etc.)

- [ ] **Performance Testing**
  - [ ] Load testing for concurrent users
  - [ ] Test CPU AI response times
  - [ ] Test database query performance
  - [ ] Monitor memory usage

- [ ] **Cross-Browser Testing**
  - [ ] Test in Chrome, Firefox, Safari, Edge
  - [ ] Test on mobile devices (if applicable)
  - [ ] Verify responsive design works correctly

## Monitoring & Maintenance

- [ ] **Monitoring Setup**
  - [ ] Set up application monitoring (e.g., New Relic, Datadog)
  - [ ] Set up uptime monitoring
  - [ ] Configure alerts for errors and downtime

- [ ] **Backup Strategy**
  - [ ] Set up database backups (Supabase should have this, but verify)
  - [ ] Document backup and restore procedures
  - [ ] Test backup restoration process

- [ ] **Documentation**
  - [ ] Update README with production deployment instructions
  - [ ] Document environment variables needed
  - [ ] Document troubleshooting procedures
  - [ ] Create runbook for common issues

## Code Quality

- [ ] **Code Review**
  - [ ] Review all code for production readiness
  - [ ] Remove console.log statements (or use proper logging)
  - [ ] Remove commented-out code
  - [ ] Verify no test/debug code is left in

- [ ] **Dependencies**
  - [ ] Review and update all dependencies to latest stable versions
  - [ ] Check for known security vulnerabilities (`npm audit`, `pip check`)
  - [ ] Update `.lock` files if using them

## Domain & DNS

- [ ] **Domain Configuration**
  - [ ] Configure custom domain (if applicable)
  - [ ] Set up DNS records
  - [ ] Verify SSL certificate is working
  - [ ] Test domain accessibility

## Launch Preparation

- [ ] **Pre-Launch Testing**
  - [ ] Test in staging environment that mirrors production
  - [ ] Verify all features work in staging
  - [ ] Test rollback procedures

- [ ] **Launch Plan**
  - [ ] Document deployment procedure
  - [ ] Schedule maintenance window (if needed)
  - [ ] Prepare rollback plan
  - [ ] Notify team/users of launch (if applicable)

---

## Notes

- This checklist should be reviewed and updated as the project evolves
- Check off items as they are completed
- Add any project-specific items that come up during development

## Priority Items (Must-Have Before Launch)

1. Replace Flask development server with production WSGI server ⚠️
2. Remove debug mode flags
3. Set up proper error logging
4. Configure production environment variables
5. Deploy to hosting platforms
6. Test end-to-end functionality in production-like environment


