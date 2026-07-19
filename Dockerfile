FROM node:20-alpine
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY package*.json ./
RUN npm ci --only=production
COPY . .
USER appuser
EXPOSE 8000
CMD ["npm", "start"]
