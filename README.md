# Guard Duty System 🛡️

A comprehensive guard duty scheduling and management system built with Next.js, designed to automate shift assignments and ensure fair distribution of duties among guards.

## Features

- **Automated Shift Scheduling**: Intelligent algorithm that automatically generates and assigns shifts based on configured parameters
- **Fair Hour Distribution**: Balances total hours worked among all guards to ensure equitable duty assignments
- **Morning Readiness Management**: Special handling for morning readiness shifts (05:30-11:00) with intelligent guard selection
- **Activity Session Support**: Pause normal scheduling for special activities (training, drills, etc.)
- **Real-time Dashboard**: Live view of current and upcoming shifts
- **Guard Management**: Add or remove guards mid-period with automatic schedule rebalancing
- **Shift Filtering**: Filter shifts by date, post, and guard
- **Responsive Design**: Fully responsive UI that works seamlessly on desktop and mobile devices
- **Dark Mode**: Full dark mode support for better viewing in low-light conditions

## Tech Stack

### Frontend
- **Next.js 15.5.4** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type-safe development
- **Tailwind CSS 4** - Utility-first CSS framework
- **date-fns** - Modern JavaScript date utility library

### Backend
- **Next.js API Routes** - Serverless API endpoints
- **Prisma 6.17.0** - Type-safe ORM
- **PostgreSQL** - Production database (Supabase)
- **Node.js 18** - Runtime environment

### Deployment
- **Netlify** - Hosting and continuous deployment
- **Supabase** - PostgreSQL database hosting
- **GitHub** - Version control and CI/CD

## Prerequisites

- Node.js 18.x or higher
- PostgreSQL database (or Supabase account)
- npm or yarn package manager

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/RoadGuardProgram.git
cd RoadGuardProgram
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://user:password@host:port/database"
DIRECT_URL="postgresql://user:password@host:port/database"
```

**Note**:
- `DATABASE_URL`: Use transaction pooler for serverless functions (port 6543 with `?pgbouncer=true`)
- `DIRECT_URL`: Use session pooler or direct connection (port 5432)

### 4. Set Up the Database

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate deploy
```

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Database Schema

The system uses the following main models:

- **GuardPeriod**: Represents a scheduling period (e.g., weekly)
- **Guard**: Individual guard information and total hours
- **Shift**: Regular duty shifts with post assignments
- **ActivitySession**: Special activities that pause normal scheduling
- **ActivityShift**: Shifts during special activities

## Scheduling Algorithm

### Key Features:

1. **Fair Distribution**: Always assigns shifts to the guard with the lowest total hours
2. **Conflict Avoidance**: Prevents overlapping shift assignments
3. **Morning Readiness**:
   - Scheduled at 05:30-11:00 daily
   - Requires 9 guards
   - Avoids assigning guards who:
     - Finished a shift within 2 hours before (03:30-05:30)
     - Were on morning readiness the previous day
4. **Dynamic Rebalancing**: When guards are added/removed, future shifts are automatically rebalanced

### Shift Types:

- **Day Shifts** (08:00-19:00): 3 posts (Gate, North, West), 1 person per post
- **Night Shifts** (19:00-08:00): 2 posts (Gate, North), 2 people per post
- **Morning Readiness** (05:30-11:00): 9 people (doesn't count toward total hours)

## User Roles

### Regular Users
- View all shifts
- View personal shift schedule
- Filter and search shifts

### Administrators
- Create new guard periods
- Add/remove guards
- Start/stop special activities
- Full system management

**Default admin credentials:**
- Username: `admin`
- Password: `admin`

**Important**: Change these credentials in production!

## Deployment

### Netlify Deployment

The project is configured for automatic deployment on Netlify:

1. Connect your GitHub repository to Netlify
2. Set environment variables in Netlify dashboard:
   - `DATABASE_URL`
   - `DIRECT_URL`
3. Deploy command: `npm run build`
4. Publish directory: `.next`

### Environment Variables in Netlify

Make sure to add these to your Netlify environment variables:
- `DATABASE_URL`: Your transaction pooler connection string
- `DIRECT_URL`: Your session pooler or direct connection string

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Database powered by [Supabase](https://supabase.com/)
- Deployed on [Netlify](https://netlify.com/)

## Support

For support, please open an issue in the GitHub repository.

---

Made with ❤️ for efficient guard duty management
