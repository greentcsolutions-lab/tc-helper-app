# Use Vercel's official Next.js base image (includes Node.js + build tools)
FROM vercel/next.js:canary

# Install Ghostscript (and any other system deps you might need later)
RUN apt-get update && \
    apt-get install -y ghostscript && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy your Next.js app
WORKDIR /app
COPY . .

# Build the app (Vercel runs this automatically, but good to have)
RUN pnpm install --frozen-lockfile && \
    pnpm build

# Expose the port (Vercel handles this)
EXPOSE 3000

# Start the app (Vercel overrides this anyway)
CMD ["pnpm", "start"]