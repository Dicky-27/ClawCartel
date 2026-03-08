FROM node:22-bullseye

WORKDIR /app

# Install system dependencies required for node-gyp and native modules
RUN apt update && apt install -y build-essential python3

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy the rest of the project
COPY . .

# Clean up cache to prevent build errors
RUN rm -rf .next && rm -rf node_modules/.cache

# **Build the Next.js application**
RUN npm run build

EXPOSE 3122

# Set NODE_ENV to production for runtime (after build)
ENV NODE_ENV=production

# Start the production server
CMD ["npm", "run", "start"]