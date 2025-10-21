# Silverleaf Academy Training Program Planner

## Overview
A web application designed for Silverleaf Academy to efficiently organize and manage their teacher training program. The application provides a professional, modern user experience, featuring the academy's navy blue branding, a clean collapsible card interface for training weeks, and robust role-based access control. Its core purpose is to allow administrators to manage training week details, including competency focus, objectives, and associated presentation files, while providing teachers with view-only access to these resources. The project aims to streamline the training program's administration and accessibility.

## User Preferences
- Clean, modern UI with vertical card layout
- Username/password authentication (no external auth providers)
- Role-based access control with manual admin creation for security
- Public teacher registration for easy onboarding
- Responsive design for all devices
- Keyboard accessibility for all interactions
- Dark mode support

## System Architecture
The application is built with a modern web stack, emphasizing a clean UI/UX and robust backend.

### UI/UX Decisions
- **Branding**: Utilizes Silverleaf Academy's navy blue branding (HSL: 220 91% 38%) as the primary color, with a professional and clean design, generous white space, and the Poppins/Inter font family. The Silverleaf Academy logo (leaf icon) is prominently displayed in all interface headers.
- **Consistent Header Design**: All interfaces (Admin, Teacher, Trainer) feature the same branded header with:
  - Silverleaf Academy logo and name
  - Primary blue background (bg-primary)
  - White text for high contrast
  - Theme toggle and logout buttons
  - User information display
- **Layout**: Features a vertical collapsible accordion card interface for organizing training weeks, enhancing content readability and navigability.
- **Visuals**: Incorporates enhanced file previews, including PDF thumbnail generation and distinct icons for PowerPoint, Word, and Excel files.
- **Accessibility**: Designed for full keyboard navigation and includes a dark mode toggle.
- **Responsiveness**: Fully responsive across desktop, tablet, and mobile devices, with adaptive layouts and element visibility.

### Technical Implementations
- **Frontend**: Developed with React, TypeScript, Tailwind CSS for styling, and Shadcn UI for componentry. Uses React Query for data fetching and caching.
- **Backend**: Implemented using Express.js with TypeScript, providing a RESTful API.
- **Authentication**: Utilizes Passport.js Local Strategy for secure username/password authentication. Passwords are hashed with scrypt. Features role-based access control (Admin/Teacher) with session management stored in PostgreSQL.
- **File Management**: Supports file uploads via Uppy.js, storing files in Replit Object Storage (Google Cloud Storage) with presigned URLs for secure access. Allows for multiple deck files per training week.
- **Inline Editing**: Provides click-to-edit functionality for key fields for admin users, with optimized cache updates for a smooth user experience.

### Feature Specifications
- **Training Week Management**: Admins can add, edit, and delete training weeks, including competency focus, objectives, and presentation files.
- **Role-Based Access Control**: Three user roles with distinct permissions:
  - **Admins**: Full CRUD capabilities for training content and user management
  - **Trainers**: Can create batches, assign teachers to batches, assign quizzes, and track teacher progress
  - **Teachers**: Can view assigned quizzes, take assessments, and track their own progress
- **Batch Management (Trainer Feature)**: 
  - Create and manage teacher batches for organized group training
  - Add/remove teachers from batches using their numeric Teacher ID
  - Assign AI-generated quizzes to entire batches
  - View detailed progress reports for all teachers in a batch
  - Track quiz completion rates, average scores, and skill levels
- **Teacher Dashboard**:
  - View assigned quizzes with detailed descriptions
  - Take quizzes with multiple-choice and true/false questions
  - Track personal progress with skill level badges (Beginner, Intermediate, Advanced)
  - View quiz history and performance statistics
- **Admin Password Reset**: Admins can reset any user's password through a dedicated UI dialog with proper validation and security.
- **File Handling**: Uploads of common presentation formats (PowerPoint, PDF, Keynote) are supported, with enhanced visual previews.
- **Progress Tracking**: Teachers must view content for 60 seconds before it's marked complete, with automatic progress tracking.

### System Design Choices
- **Database**: PostgreSQL is used as the primary data store, with Drizzle ORM for type-safe database interactions. Sessions are also stored in PostgreSQL.
- **Project Structure**: Organized into `client/`, `server/`, and `shared/` directories for clear separation of concerns.

## External Dependencies
- **Database**: PostgreSQL (specifically Neon for deployment)
- **ORM**: Drizzle ORM
- **Authentication**: Passport.js (Local Strategy), connect-pg-simple (for PostgreSQL session storage)
- **File Storage**: Replit Object Storage (backed by Google Cloud Storage)
- **File Upload Library**: Uppy.js with AWS S3 plugin (for interacting with Replit Object Storage)
- **UI Framework**: Shadcn UI
- **Styling**: Tailwind CSS
- **PDF Previews**: react-pdf library

## Deployment & Database Management

### Database Architecture
- **Development vs Production**: Replit automatically manages separate databases for development and production environments
- **Connection String**: `DATABASE_URL` environment variable automatically switches between dev/prod databases based on `NODE_ENV`
- **Data Persistence**: All user credentials, training content, and progress data are permanently stored in PostgreSQL
- **Multi-User Consistency**: Changes made by admins are instantly visible to all users across all sessions

### Production Database Setup
1. **Initial Deployment**: After first deployment, run the database initialization script:
   ```bash
   NODE_ENV=production tsx server/init-db.ts
   ```
2. **What It Does**:
   - Creates/updates the admin user with email `admin@silverleaf.com` and password `admin123`
   - Verifies database connection and environment
   - Ensures proper password hashing with scrypt
3. **Verification**: Login to the deployed app with admin credentials to confirm setup

### Database Initialization Script
- **Location**: `server/init-db.ts`
- **Purpose**: Ensures admin user exists with correct credentials in production
- **Features**:
  - Automatically detects environment (development/production)
  - Creates admin user if missing
  - Updates admin password if user exists
  - Logs database connection details for verification

### Admin Credentials
- **Email**: admin@silverleaf.com
- **Default Password**: admin123
- **Security Note**: Change password immediately after first login using the "Reset User Password" feature

### Environment Variables (Auto-Managed by Replit)
- `DATABASE_URL` - PostgreSQL connection (switches dev/prod automatically)
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID` - File storage bucket ID
- `PUBLIC_OBJECT_SEARCH_PATHS` - Public file paths
- `PRIVATE_OBJECT_DIR` - Private file directory
- `SESSION_SECRET` - Express session encryption key

### Troubleshooting
- **Issue**: Admin login fails in production
  - **Solution**: Run `NODE_ENV=production tsx server/init-db.ts` to initialize/fix admin user
- **Issue**: Reset Password button not visible in deployed app
  - **Cause**: Admin user doesn't exist in production database
  - **Solution**: Run initialization script to create admin user
- **Issue**: Files uploaded in development don't appear in production
  - **Cause**: Separate databases mean separate data
  - **Solution**: Re-upload files after deployment or use database export/import

See `DEPLOYMENT.md` for complete deployment guide and best practices.