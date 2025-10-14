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
- **Branding**: Utilizes Silverleaf Academy's navy blue branding (hsl(220, 80%, 32%)) as the primary color, with a professional and clean design, generous white space, and the Inter font family.
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
- **Role-Based Access Control**: Admins have full CRUD capabilities, while Teachers have view-only access. Teacher registration is public; admin accounts are created manually in the database.
- **File Handling**: Uploads of common presentation formats (PowerPoint, PDF, Keynote) are supported, with enhanced visual previews.

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