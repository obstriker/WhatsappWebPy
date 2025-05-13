# Use Node.js official image as the base
FROM node:16

# Set the working directory inside the container
WORKDIR /app

# Copy only the package.json and package-lock.json (if they exist) first to take advantage of Docker's caching
COPY package*.json /app/

# Install dependencies
RUN npm install
RUN npm install puppeteer --save

# Install system dependencies required for Puppeteer (Chromium)
RUN apt-get update && apt-get install -y \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libxcomposite1 \
  libxdamage1 libxrandr2 libxkbcommon0 libgbm1 libxshmfence1 libasound2 \
  libpangocairo-1.0-0 libpangoft2-1.0-0 libgtk-3-0 libdrm2

# Copy the rest of your app files into the container
COPY . /app

# Expose port 3000 for the application
EXPOSE 3000

# Run the server when the container starts
CMD ["node", "whatsapp_client/node_server.js"]
