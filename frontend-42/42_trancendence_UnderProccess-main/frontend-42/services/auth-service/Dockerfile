FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache openssl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source
COPY src ./src/

EXPOSE 3001

CMD ["sh", "-c", "npx prisma db push --skip-generate && npm run dev"]
