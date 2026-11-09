FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts
COPY . .
ENV HOST=0.0.0.0
USER node
EXPOSE 8080
CMD ["node","cloud/server.mjs"]
