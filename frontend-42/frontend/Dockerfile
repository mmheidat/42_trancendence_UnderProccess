# Use Node.js LTS version
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY tailwind.config.js ./
COPY postcss.config.js ./

# Install dependencies
RUN npm install

# Copy source files
COPY src ./src

# Expose port 8080
EXPOSE 8080

# Start Vite dev server
CMD ["npm", "run", "dev"]