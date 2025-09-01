# Deployment Guide

This guide explains how to deploy the PDF to Markdown Converter application in various environments.

## 🚀 Quick Deployment

### Local Development
The application is ready to run locally without any build process:

1. **Clone or Download** the project files
2. **Open `index.html`** in a modern web browser
3. **Start Converting** - The application is fully functional

### Static Web Hosting
Deploy to any static hosting service:

1. **Upload all files** to your web server
2. **Ensure HTTPS** for security (required for some browser APIs)
3. **Set proper MIME types** for `.js` and `.css` files
4. **Configure CSP headers** (optional, see security section)

## 🌐 Hosting Platforms

### GitHub Pages
1. Create a new repository or use existing one
2. Upload all project files to the repository
3. Go to Settings → Pages
4. Select source branch (usually `main`)
5. Your app will be available at `https://username.github.io/repository-name`

### Netlify
1. Drag and drop the project folder to Netlify
2. Or connect your Git repository
3. No build configuration needed
4. Automatic HTTPS and CDN distribution

### Vercel
1. Import your Git repository
2. No build settings required
3. Automatic deployment on push
4. Global CDN and HTTPS included

### Firebase Hosting
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Initialize Firebase in your project directory
firebase init hosting

# Deploy
firebase deploy
```

### AWS S3 + CloudFront
1. Create S3 bucket with static website hosting
2. Upload all files to the bucket
3. Configure CloudFront distribution for HTTPS
4. Set up custom domain (optional)

## ⚙️ Server Configuration

### Apache (.htaccess)
```apache
# Enable HTTPS redirect
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Set proper MIME types
AddType application/javascript .js
AddType text/css .css
AddType application/json .json

# Enable compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
</IfModule>

# Cache static assets
<IfModule mod_expires.c>
    ExpiresActive on
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
</IfModule>
```

### Nginx
```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL configuration
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    root /path/to/pdf-to-markdown-converter;
    index index.html;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    
    # CSP header (adjust as needed)
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://unpkg.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; img-src 'self' data: blob:; connect-src 'self' blob:; worker-src 'self' blob:; wasm-src 'self' https://cdnjs.cloudflare.com https://unpkg.com;";
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
```

## 🔒 Security Considerations

### Content Security Policy (CSP)
The application includes a CSP header in the HTML. For production, consider:

```html
<meta http-equiv="Content-Security-Policy" content="
    default-src 'self'; 
    script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://unpkg.com; 
    style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; 
    img-src 'self' data: blob:; 
    connect-src 'self' blob:; 
    worker-src 'self' blob:; 
    wasm-src 'self' https://cdnjs.cloudflare.com https://unpkg.com;
">
```

### HTTPS Requirements
- **Required** for production deployment
- Needed for secure file handling APIs
- Required for service worker functionality (if added)
- Improves user trust and SEO

### Privacy Compliance
- **No data collection** - Application is fully client-side
- **No cookies** - No tracking or session management
- **No analytics** - No user behavior tracking
- **GDPR compliant** - No personal data processing

## 📊 Performance Optimization

### CDN Configuration
The application uses CDN resources for dependencies:
- PDF.js from cdnjs.cloudflare.com
- Turndown.js from unpkg.com
- FileSaver.js from cdnjs.cloudflare.com
- JSZip from cdnjs.cloudflare.com

### Local Dependencies (Optional)
For better performance or offline usage, download dependencies locally:

1. Download all CDN resources
2. Place in a `libs/` directory
3. Update script tags in `index.html`
4. Update CSP headers accordingly

### Compression
Enable gzip/brotli compression for:
- HTML, CSS, JavaScript files
- JSON configuration files
- SVG images

### Caching Strategy
- **Static assets**: Long-term caching (1 year)
- **HTML files**: Short-term caching or no-cache
- **API responses**: Not applicable (client-side only)

## 🧪 Testing Deployment

### Pre-deployment Checklist
- [ ] All files uploaded correctly
- [ ] HTTPS enabled and working
- [ ] No console errors in browser
- [ ] File upload functionality works
- [ ] PDF processing completes successfully
- [ ] Download functionality works
- [ ] Mobile responsiveness verified
- [ ] Cross-browser compatibility tested

### Browser Testing
Test in multiple browsers:
- Chrome/Chromium (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

### Performance Testing
- Test with various PDF sizes (small, medium, large)
- Verify memory usage doesn't exceed browser limits
- Check processing speed on different devices
- Test batch processing with multiple files

## 🔧 Troubleshooting

### Common Issues

**Files not loading:**
- Check MIME types are set correctly
- Verify HTTPS is enabled
- Check browser console for errors

**CSP violations:**
- Adjust CSP headers to allow required resources
- Check for inline scripts or styles
- Verify CDN domains are whitelisted

**Performance issues:**
- Enable compression
- Optimize images and assets
- Use CDN for static resources
- Check for memory leaks

**Mobile issues:**
- Test touch interactions
- Verify responsive design
- Check file size limits on mobile
- Test offline functionality

### Debug Mode
Add `?debug=true` to the URL to enable debug logging:
```javascript
// In app.js, add debug logging
if (new URLSearchParams(window.location.search).get('debug') === 'true') {
    window.DEBUG = true;
    console.log('Debug mode enabled');
}
```

## 📈 Monitoring

### Error Tracking
Consider adding error tracking for production:
```javascript
window.addEventListener('error', (event) => {
    // Log to your error tracking service
    console.error('Application error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    // Log promise rejections
    console.error('Unhandled promise rejection:', event.reason);
});
```

### Usage Analytics (Optional)
If you need usage analytics, consider privacy-friendly options:
- Self-hosted analytics (e.g., Plausible, Matomo)
- Simple usage counters without personal data
- Performance monitoring without user tracking

## 🚀 Advanced Deployment

### Docker Container
```dockerfile
FROM nginx:alpine

COPY . /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pdf-to-markdown
spec:
  replicas: 3
  selector:
    matchLabels:
      app: pdf-to-markdown
  template:
    metadata:
      labels:
        app: pdf-to-markdown
    spec:
      containers:
      - name: pdf-to-markdown
        image: your-registry/pdf-to-markdown:latest
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: pdf-to-markdown-service
spec:
  selector:
    app: pdf-to-markdown
  ports:
  - port: 80
    targetPort: 80
  type: LoadBalancer
```

### CI/CD Pipeline
Example GitHub Actions workflow:
```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    
    - name: Deploy to Netlify
      uses: nwtgck/actions-netlify@v1.2
      with:
        publish-dir: '.'
        production-branch: main
      env:
        NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
        NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

---

**Ready to deploy?** Choose your preferred hosting platform and follow the appropriate steps above. The application is designed to work out-of-the-box on any static hosting service with HTTPS support.
