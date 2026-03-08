FROM node:20
WORKDIR /usr/src/app

# Step 1: Copy only package files and install dependencies
COPY package*.json ./

# Step 2: Remove any cached node_modules and install fresh (always clean)
RUN rm -rf node_modules package-lock.json ~/.npm && \
    npm cache clean --force && \
    npm install --include=optional --no-cache && \
    npm rebuild sharp

# Step 3: Copy all source code AFTER dependencies are installed
COPY . .

# Step 4: Prisma
RUN npx prisma generate

EXPOSE 3000
# Run node directly (not via npm) so PID 1 receives SIGTERM and graceful shutdown works (Easypanel/Docker stop).
CMD ["node", "--import", "tsx", "index.ts"]