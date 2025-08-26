# Campus Connect Waitlist API 🎓

A robust Express.js backend server for managing email waitlists. Collect subscriber emails and send notifications when your service is ready for launch.

## Features ✨

- ✅ Email subscription management
- ✅ Automated welcome emails
- ✅ Bulk launch notifications
- ✅ Rate limiting and input validation
- ✅ MongoDB integration
- ✅ Gmail SMTP integration
- ✅ Admin endpoints for management
- ✅ Comprehensive error handling

## Tech Stack 🛠️

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Email**: Nodemailer with Gmail SMTP
- **Security**: Rate limiting, input validation
- **Environment**: Dotenv for configuration

## Prerequisites 📋

- Node.js (v14 or higher)
- MongoDB Atlas account or local MongoDB
- Gmail account with 2-factor authentication enabled
- Git

## Installation 🚀

1. **Clone the repository**
   ```bash
   git clone https://github.com/Desmond18811/campus-connect-waitlist.git
   cd campus-connect-waitlist
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```env
   PORT=8080
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-app-password
   FRONTEND_URL=http://localhost:3000
   ```

4. **Gmail Setup**
   - Enable 2-factor authentication on your Gmail account
   - Generate an app password:
     - Go to Google Account → Security → 2-Step Verification → App passwords
     - Generate password for "Mail"
     - Use the 16-character password in your `.env` file

5. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## API Endpoints 📡

### Subscribe to Waitlist
```http
POST /api/subscribe
Content-Type: application/json

{
  "email": "user@example.com"
}
```

### Get Subscriber Count
```http
GET /api/subscribe/count
```

### Get All Subscribers
```http
GET /api/subscribe/all
```

### Send Launch Notifications
```http
POST /api/subscribe/notify-launch
```

### Health Check
```http
GET /health
```

## Project Structure 📁

```
src/
├── controllers/          # Route controllers
│   └── subscription.js
├── models/              # Database models
│   └── Subscribers.js
├── routes/              # Express routes
│   └── subscriptionRouter.js
├── middleware/          # Custom middleware
│   └── validation.js
├── utils/               # Utility functions
│   └── EmailService.js
├── config/              # Configuration files
│   └── database.js
└── server.js           # Main server file
```

## Usage Examples 💡

### Subscribe a User
```bash
curl -X POST http://localhost:8080/api/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

### Get Subscriber Count
```bash
curl http://localhost:8080/api/subscribe/count
```

### Get All Subscribers
```bash
curl http://localhost:8080/api/subscribe/all
```

### Send Launch Notifications
```bash
curl -X POST http://localhost:8080/api/subscribe/notify-launch
```

## Environment Variables 🔧

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `8080` |
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://...` |
| `EMAIL_HOST` | SMTP host | `smtp.gmail.com` |
| `EMAIL_PORT` | SMTP port | `587` |
| `EMAIL_USER` | Gmail address | `your-email@gmail.com` |
| `EMAIL_PASSWORD` | Gmail app password | `abcd efgh ijkl mnop` |
| `FRONTEND_URL` | Frontend application URL | `http://localhost:3000` |

## Error Handling ⚠️

The API returns standardized error responses:

```json
{
  "status": "error",
  "statusCode": 400,
  "error": "Error message description"
}
```

Common error codes:
- `400` - Bad Request (validation errors)
- `404` - Not Found (resource not found)
- `409` - Conflict (duplicate email)
- `429` - Too Many Requests (rate limiting)
- `500` - Internal Server Error

## Rate Limiting ⏱️

- Subscription endpoint: 5 requests per hour per IP
- Other endpoints: 60 requests per minute per IP

## Contributing 🤝

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Development Scripts 📜

```bash
npm start          # Start production server
npm run dev        # Start development server with nodemon
```

## Security Considerations 🔒

- Always use environment variables for sensitive data
- Enable CORS for your specific frontend domain
- Use HTTPS in production
- Regularly update dependencies
- Implement proper authentication for admin endpoints

## Troubleshooting 🔍

### Email Issues
- Ensure 2-factor authentication is enabled on Gmail
- Use app passwords, not your regular Gmail password
- Check that less secure apps access is disabled (app passwords should work regardless)

### Database Issues
- Verify MongoDB connection string
- Check network connectivity to MongoDB Atlas

### Rate Limiting
- If testing frequently, consider increasing rate limits in development

## Support 💬

If you have any questions or issues, please open an issue on GitHub or contact:

- Email: ubidesmond62@gmail.com
- GitHub: [YourUsername](https://github.com/Desmond18811)

## License 📄

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments 🙏

- Built with Express.js
- MongoDB for data persistence
- Nodemailer for email functionality
- Rate limiting middleware for security

---

**⭐ Star this repo if you found it helpful!**
