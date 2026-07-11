FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy backend
COPY backend/ ./backend/
WORKDIR /app/backend
RUN pnpm install --prod

# Copy frontend build
WORKDIR /app
COPY frontend/dist/ ./frontend/dist/

EXPOSE 3000

# Start backend (serves both API + static files)
WORKDIR /app/backend
CMD ["node", "dist/index.js"]
